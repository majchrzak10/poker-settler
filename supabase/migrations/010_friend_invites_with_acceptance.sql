-- 010: Zaproszenia do znajomych z akceptacją w aplikacji
-- Flow:
-- 1) Organizator dodaje lokalnego gracza z emailem.
-- 2) Tworzy się pending invite (friend_invites).
-- 3) Znajomy akceptuje/odrzuca w Profilu.
-- 4) Przy akceptacji tworzy się dwustronne powiązanie players.linked_user_id.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS players_email_idx ON public.players (email);

CREATE TABLE IF NOT EXISTS public.friend_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  invitee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS friend_invites_requester_user_idx ON public.friend_invites (requester_user_id);
CREATE INDEX IF NOT EXISTS friend_invites_invitee_user_idx ON public.friend_invites (invitee_user_id);
CREATE INDEX IF NOT EXISTS friend_invites_invitee_email_idx ON public.friend_invites ((LOWER(invitee_email)));

CREATE UNIQUE INDEX IF NOT EXISTS friend_invites_pending_unique
  ON public.friend_invites (requester_player_id, LOWER(invitee_email))
  WHERE status = 'pending';

ALTER TABLE public.friend_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friend_invites_select_related" ON public.friend_invites;
CREATE POLICY "friend_invites_select_related"
  ON public.friend_invites
  FOR SELECT TO authenticated
  USING (
    requester_user_id = auth.uid()
    OR invitee_user_id = auth.uid()
    OR LOWER(invitee_email) = LOWER(COALESCE((SELECT email FROM public.profiles WHERE id = auth.uid()), ''))
  );

DROP POLICY IF EXISTS "friend_invites_insert_own" ON public.friend_invites;
CREATE POLICY "friend_invites_insert_own"
  ON public.friend_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = requester_player_id
        AND p.owner_id = auth.uid()
    )
  );

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
  VALUES (gen_random_uuid(), v_me, v_invite.requester_user_id, COALESCE(v_requester_name, 'Gracz'), NULLIF(v_requester_email, ''))
  ON CONFLICT (owner_id, linked_user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_friend_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_my_email text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;

  SELECT LOWER(TRIM(COALESCE(email, '')))
    INTO v_my_email
  FROM public.profiles
  WHERE id = v_me;

  UPDATE public.friend_invites
  SET status = 'rejected',
      invitee_user_id = COALESCE(invitee_user_id, v_me),
      responded_at = now()
  WHERE id = p_invite_id
    AND status = 'pending'
    AND (
      invitee_user_id = v_me
      OR LOWER(TRIM(invitee_email)) = v_my_email
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono aktywnego zaproszenia dla tego konta.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_friend_invite(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_friend_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_friend_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_friend_invite(uuid) TO authenticated;
