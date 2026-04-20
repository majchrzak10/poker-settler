-- 023: Tabela propozycji edycji sesji przez gościa + RPC propose/respond
--
-- Gość (uczestnik sesji z participations) może zaproponować zmianę kwot.
-- Host (sessions.owner_id) akceptuje lub odrzuca propozycję.
-- Akceptacja wywołuje update_session_atomic i nadpisuje dane sesji.

CREATE TABLE IF NOT EXISTS public.session_edit_proposals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  proposer_user_id uuid NOT NULL REFERENCES auth.users(id),
  payload         jsonb NOT NULL,  -- { players: [...], transfers: [...], total_pot }
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','rejected','cancelled')),
  note            text,
  created_at      timestamptz DEFAULT now(),
  responded_at    timestamptz
);

ALTER TABLE public.session_edit_proposals ENABLE ROW LEVEL SECURITY;

-- Proposer widzi i zarządza własnymi propozycjami
CREATE POLICY "proposer_select" ON public.session_edit_proposals
  FOR SELECT USING (proposer_user_id = auth.uid());

CREATE POLICY "proposer_insert" ON public.session_edit_proposals
  FOR INSERT WITH CHECK (proposer_user_id = auth.uid());

CREATE POLICY "proposer_update_cancel" ON public.session_edit_proposals
  FOR UPDATE USING (proposer_user_id = auth.uid() AND status = 'pending')
  WITH CHECK (status = 'cancelled');

-- Host sesji widzi wszystkie propozycje dotyczące swoich sesji
CREATE POLICY "host_select" ON public.session_edit_proposals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.sessions WHERE id = session_id AND owner_id = auth.uid())
  );

CREATE POLICY "host_update_respond" ON public.session_edit_proposals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.sessions WHERE id = session_id AND owner_id = auth.uid())
    AND status = 'pending'
  );

-- Dodaj do realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_edit_proposals;

-- ─── RPC: propose_session_edit ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.propose_session_edit(
  p_session_id  uuid,
  p_payload     jsonb,
  p_note        text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Tylko uczestnicy sesji mogą zgłaszać propozycje
  IF NOT EXISTS (
    SELECT 1 FROM public.participations
    WHERE session_id = p_session_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = p_session_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not a participant';
  END IF;

  INSERT INTO public.session_edit_proposals (session_id, proposer_user_id, payload, note)
  VALUES (p_session_id, auth.uid(), p_payload, p_note)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ─── RPC: respond_session_edit ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.respond_session_edit(
  p_proposal_id uuid,
  p_decision    text  -- 'accepted' | 'rejected'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal  public.session_edit_proposals%ROWTYPE;
  v_session   public.sessions%ROWTYPE;
  v_payload   jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_decision NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  SELECT * INTO v_proposal FROM public.session_edit_proposals
  WHERE id = p_proposal_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposal not found or already resolved';
  END IF;

  SELECT * INTO v_session FROM public.sessions
  WHERE id = v_proposal.session_id AND owner_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.session_edit_proposals
  SET status = p_decision, responded_at = now()
  WHERE id = p_proposal_id;

  IF p_decision = 'accepted' THEN
    v_payload := v_proposal.payload;

    -- Aktualizuj cash_out po player_name (zachowuje linkowane player_id)
    UPDATE public.session_players sp
    SET cash_out = (elem->>'cash_out')::bigint
    FROM jsonb_array_elements(COALESCE(v_payload->'players', '[]'::jsonb)) AS elem
    WHERE sp.session_id = v_proposal.session_id
      AND sp.player_name = elem->>'player_name';

    -- Aktualizuj participations tak samo
    UPDATE public.participations p
    SET cash_out = (elem->>'cash_out')::bigint
    FROM jsonb_array_elements(COALESCE(v_payload->'players', '[]'::jsonb)) AS elem
    WHERE p.session_id = v_proposal.session_id
      AND p.player_name = elem->>'player_name';

    -- Aktualizuj total_pot jeśli podany
    IF v_payload ? 'total_pot' THEN
      UPDATE public.sessions
      SET total_pot = (v_payload->>'total_pot')::bigint
      WHERE id = v_proposal.session_id;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.propose_session_edit(uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_session_edit(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propose_session_edit(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_session_edit(uuid, text) TO authenticated;
