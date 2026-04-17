-- 012: Allow requester to revoke (cancel) pending friend invite.

CREATE OR REPLACE FUNCTION public.cancel_friend_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;

  UPDATE public.friend_invites
  SET status = 'cancelled',
      responded_at = now()
  WHERE id = p_invite_id
    AND requester_user_id = v_me
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono aktywnego zaproszenia do cofnięcia.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_friend_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_friend_invite(uuid) TO authenticated;
