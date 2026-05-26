-- 030: S1 — optimistic locking dla sesji.
--
-- Problem: dwa urządzenia ownera edytują tę samą historyczną sesję,
-- update_session_atomic NIE sprawdza wersji → ostatni zapis cicho nadpisuje
-- wcześniejszy. Brak `updated_at`, brak ETag.
--
-- Fix:
-- 1) Dodaj kolumnę sessions.updated_at + trigger BEFORE UPDATE
-- 2) Rozszerz update_session_atomic o opcjonalny parametr
--    p_expected_updated_at (timestamptz). Gdy podany — RAISE 'session_conflict'
--    jeśli aktualny updated_at jest nowszy. NULL = stary zachowanie (zgodność
--    wsteczna z klientami przed-migracji).
-- 3) RETURNS timestamptz: nowy updated_at, żeby klient mógł go zapamiętać
--    do kolejnego zapisu.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.sessions_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sessions_updated_at ON public.sessions;
CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.sessions_set_updated_at();

CREATE OR REPLACE FUNCTION public.update_session_atomic(
  p_session_id uuid,
  p_owner_id uuid,
  p_played_at timestamptz,
  p_total_pot bigint,
  p_session_players jsonb,
  p_transfers jsonb,
  p_participations jsonb,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bad uuid;
  v_current_updated_at timestamptz;
  v_new_updated_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT updated_at INTO v_current_updated_at
  FROM public.sessions
  WHERE id = p_session_id AND owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found';
  END IF;

  IF p_expected_updated_at IS NOT NULL
     AND v_current_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'session_conflict' USING ERRCODE = 'P0001';
  END IF;

  SELECT (elem->>'user_id')::uuid
    INTO v_bad
  FROM jsonb_array_elements(COALESCE(p_participations, '[]'::jsonb)) AS elem
  WHERE (elem->>'user_id') IS NOT NULL
    AND (elem->>'user_id')::uuid <> auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.players pl
      WHERE pl.owner_id = auth.uid()
        AND pl.linked_user_id = (elem->>'user_id')::uuid
    )
  LIMIT 1;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden participation user_id %', v_bad;
  END IF;

  UPDATE public.sessions
  SET played_at = p_played_at, total_pot = p_total_pot
  WHERE id = p_session_id
  RETURNING updated_at INTO v_new_updated_at;

  DELETE FROM public.session_players WHERE session_id = p_session_id;
  DELETE FROM public.transfers WHERE session_id = p_session_id;
  DELETE FROM public.participations WHERE session_id = p_session_id;

  INSERT INTO public.session_players (session_id, player_id, player_name, total_buy_in, cash_out)
  SELECT p_session_id,
         (elem->>'player_id')::uuid,
         COALESCE(elem->>'player_name', '?'),
         COALESCE((elem->>'total_buy_in')::bigint, 0),
         COALESCE((elem->>'cash_out')::bigint, 0)
  FROM jsonb_array_elements(COALESCE(p_session_players, '[]'::jsonb)) AS elem;

  INSERT INTO public.transfers (session_id, from_name, to_name, amount)
  SELECT p_session_id,
         elem->>'from_name',
         elem->>'to_name',
         COALESCE((elem->>'amount')::bigint, 0)
  FROM jsonb_array_elements(COALESCE(p_transfers, '[]'::jsonb)) AS elem;

  INSERT INTO public.participations (user_id, session_id, player_name, total_buy_in, cash_out, session_date, total_pot)
  SELECT (elem->>'user_id')::uuid,
         p_session_id,
         COALESCE(elem->>'player_name', '?'),
         COALESCE((elem->>'total_buy_in')::bigint, 0),
         COALESCE((elem->>'cash_out')::bigint, 0),
         (elem->>'session_date')::timestamptz,
         COALESCE((elem->>'total_pot')::bigint, 0)
  FROM jsonb_array_elements(COALESCE(p_participations, '[]'::jsonb)) AS elem
  ON CONFLICT (user_id, session_id) DO UPDATE SET
    player_name = EXCLUDED.player_name,
    total_buy_in = EXCLUDED.total_buy_in,
    cash_out = EXCLUDED.cash_out,
    session_date = EXCLUDED.session_date,
    total_pot = EXCLUDED.total_pot;

  RETURN v_new_updated_at;
END;
$$;

DROP FUNCTION IF EXISTS public.update_session_atomic(uuid, uuid, timestamptz, bigint, jsonb, jsonb, jsonb);

REVOKE ALL ON FUNCTION public.update_session_atomic(uuid, uuid, timestamptz, bigint, jsonb, jsonb, jsonb, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_session_atomic(uuid, uuid, timestamptz, bigint, jsonb, jsonb, jsonb, timestamptz) TO authenticated;
