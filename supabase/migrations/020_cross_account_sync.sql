-- 020: Spójna synchronizacja między kontami
--
-- 1. Trigger na session_players: automatycznie wstawia wpis do `participations`
--    dla każdego gracza, który ma ustawione `players.linked_user_id` (i nie jest
--    to sam właściciel sesji). Dzięki temu nawet jeśli klient zapomni wysłać
--    participations, gość i tak zobaczy sesję.
-- 2. RLS na `session_players` i `transfers`: pozwala uczestnikom sesji (obecnym
--    w `participations`) czytać pełną listę graczy i przelewów. Wcześniej
--    domyślna polityka pozwalała tylko właścicielowi. Frontend może teraz
--    pokazać gościowi pełny skład sesji u znajomego.
-- 3. `complete_friend_player_link` + `accept_friend_invite`: po powiązaniu
--    zaprasza automatycznie uzupełnia participations za historyczne sesje,
--    w których ten gracz brał udział.

-- =============================================================================
-- 1. Unikalny indeks + trigger auto-participations
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS participations_user_session_unique
  ON public.participations (user_id, session_id);

CREATE OR REPLACE FUNCTION public.auto_create_participation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linked_user_id UUID;
  v_session_owner UUID;
  v_played_at TIMESTAMPTZ;
  v_total_pot INTEGER;
BEGIN
  IF NEW.player_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.owner_id, s.played_at, s.total_pot
    INTO v_session_owner, v_played_at, v_total_pot
  FROM public.sessions s
  WHERE s.id = NEW.session_id;

  IF v_session_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.linked_user_id INTO v_linked_user_id
  FROM public.players p
  WHERE p.id = NEW.player_id;

  IF v_linked_user_id IS NULL OR v_linked_user_id = v_session_owner THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.participations
    (user_id, session_id, player_name, total_buy_in, cash_out, session_date, total_pot)
  VALUES
    (v_linked_user_id, NEW.session_id, NEW.player_name,
     COALESCE(NEW.total_buy_in, 0), NEW.cash_out, v_played_at, COALESCE(v_total_pot, 0))
  ON CONFLICT (user_id, session_id) DO UPDATE SET
    player_name = EXCLUDED.player_name,
    total_buy_in = EXCLUDED.total_buy_in,
    cash_out = EXCLUDED.cash_out,
    session_date = EXCLUDED.session_date,
    total_pot = EXCLUDED.total_pot;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS session_players_auto_participation ON public.session_players;
CREATE TRIGGER session_players_auto_participation
  AFTER INSERT ON public.session_players
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_participation();

-- =============================================================================
-- 2. RLS: session_players i transfers widoczne dla uczestników
-- =============================================================================

ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_players_select_owner_or_participant" ON public.session_players;
CREATE POLICY "session_players_select_owner_or_participant"
  ON public.session_players
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_players.session_id AND s.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.participations p
      WHERE p.session_id = session_players.session_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "session_players_insert_owner" ON public.session_players;
CREATE POLICY "session_players_insert_owner"
  ON public.session_players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_players.session_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "session_players_update_owner" ON public.session_players;
CREATE POLICY "session_players_update_owner"
  ON public.session_players
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_players.session_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "session_players_delete_owner" ON public.session_players;
CREATE POLICY "session_players_delete_owner"
  ON public.session_players
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_players.session_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "transfers_select_owner_or_participant" ON public.transfers;
CREATE POLICY "transfers_select_owner_or_participant"
  ON public.transfers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = transfers.session_id AND s.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.participations p
      WHERE p.session_id = transfers.session_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "transfers_insert_owner" ON public.transfers;
CREATE POLICY "transfers_insert_owner"
  ON public.transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = transfers.session_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "transfers_update_owner" ON public.transfers;
CREATE POLICY "transfers_update_owner"
  ON public.transfers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = transfers.session_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "transfers_delete_owner" ON public.transfers;
CREATE POLICY "transfers_delete_owner"
  ON public.transfers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = transfers.session_id AND s.owner_id = auth.uid()
    )
  );

-- =============================================================================
-- 3. Retroaktywny backfill participations przy powiązaniu gracza
-- =============================================================================

CREATE OR REPLACE FUNCTION public.backfill_participations_for_player(
  p_player_id uuid,
  p_friend_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT owner_id INTO v_owner_id FROM public.players WHERE id = p_player_id;
  IF v_owner_id IS NULL OR p_friend_user_id IS NULL OR p_friend_user_id = v_owner_id THEN
    RETURN;
  END IF;

  INSERT INTO public.participations
    (user_id, session_id, player_name, total_buy_in, cash_out, session_date, total_pot)
  SELECT
    p_friend_user_id,
    sp.session_id,
    sp.player_name,
    COALESCE(sp.total_buy_in, 0),
    sp.cash_out,
    s.played_at,
    COALESCE(s.total_pot, 0)
  FROM public.session_players sp
  JOIN public.sessions s ON s.id = sp.session_id
  WHERE sp.player_id = p_player_id
    AND s.owner_id = v_owner_id
  ON CONFLICT (user_id, session_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_participations_for_player(uuid, uuid) FROM PUBLIC;

-- Podmień complete_friend_player_link, żeby dołożył retroaktywny backfill.
CREATE OR REPLACE FUNCTION public.complete_friend_player_link(p_player_id uuid, p_friend_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_my_name text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;
  IF p_friend_user_id = v_me THEN
    RAISE EXCEPTION 'Nie możesz połączyć z własnym kontem.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = p_player_id AND owner_id = v_me) THEN
    RAISE EXCEPTION 'Nie znaleziono gracza lub brak uprawnień.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_friend_user_id) THEN
    RAISE EXCEPTION 'Nie znaleziono konta znajomego.';
  END IF;

  UPDATE public.players
  SET linked_user_id = p_friend_user_id
  WHERE id = p_player_id AND owner_id = v_me;

  v_my_name := COALESCE(
    (SELECT COALESCE(
      NULLIF(TRIM(display_name), ''),
      NULLIF(SPLIT_PART(LOWER(TRIM(COALESCE(email, ''))), '@', 1), ''),
      'Gracz'
    )
    FROM public.profiles
    WHERE id = v_me
    LIMIT 1),
    'Gracz'
  );

  INSERT INTO public.players (id, owner_id, linked_user_id, name)
  VALUES (gen_random_uuid(), p_friend_user_id, v_me, v_my_name)
  ON CONFLICT (owner_id, linked_user_id) DO NOTHING;

  PERFORM public.backfill_participations_for_player(p_player_id, p_friend_user_id);
END;
$$;

-- Podmień accept_friend_invite, żeby też uzupełniał participations
-- dla historycznych sesji, w których gracz był w session_players.
CREATE OR REPLACE FUNCTION public.accept_friend_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_my_email text;
  v_invite public.friend_invites%ROWTYPE;
  v_requester_name text;
  v_requester_email text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;

  SELECT LOWER(TRIM(COALESCE(email, '')))
    INTO v_my_email
  FROM public.profiles
  WHERE id = v_me;

  SELECT *
    INTO v_invite
  FROM public.friend_invites
  WHERE id = p_invite_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Zaproszenie nie istnieje albo nie jest już aktywne.';
  END IF;

  IF v_invite.requester_user_id = v_me THEN
    RAISE EXCEPTION 'Nie możesz zaakceptować własnego zaproszenia.';
  END IF;

  IF NOT (
    v_invite.invitee_user_id = v_me
    OR LOWER(TRIM(v_invite.invitee_email)) = v_my_email
  ) THEN
    RAISE EXCEPTION 'To zaproszenie nie jest przeznaczone dla Ciebie.';
  END IF;

  UPDATE public.friend_invites
  SET status = 'accepted',
      invitee_user_id = v_me,
      responded_at = now()
  WHERE id = p_invite_id;

  UPDATE public.players
  SET linked_user_id = v_me
  WHERE id = v_invite.requester_player_id
    AND owner_id = v_invite.requester_user_id;

  SELECT
    COALESCE(
      NULLIF(TRIM(display_name), ''),
      NULLIF(SPLIT_PART(LOWER(TRIM(COALESCE(email, ''))), '@', 1), ''),
      'Gracz'
    ),
    LOWER(TRIM(COALESCE(email, '')))
  INTO v_requester_name, v_requester_email
  FROM public.profiles
  WHERE id = v_invite.requester_user_id
  LIMIT 1;

  INSERT INTO public.players (id, owner_id, linked_user_id, name, email)
  VALUES (gen_random_uuid(), v_me, v_invite.requester_user_id,
          COALESCE(v_requester_name, 'Gracz'), NULLIF(v_requester_email, ''))
  ON CONFLICT (owner_id, linked_user_id) DO NOTHING;

  PERFORM public.backfill_participations_for_player(v_invite.requester_player_id, v_me);
END;
$$;

-- =============================================================================
-- 4. Realtime publication — upewnij się że participations ma REPLICA IDENTITY FULL
--    (bez tego RLS przy UPDATE może filtrować eventy)
-- =============================================================================

ALTER TABLE public.participations REPLICA IDENTITY FULL;
ALTER TABLE public.session_players REPLICA IDENTITY FULL;
ALTER TABLE public.transfers REPLICA IDENTITY FULL;
