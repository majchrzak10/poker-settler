-- 018: Odepnij znajomego — idempotentnie (brak wiersza = sukces, nie wyjątek).
-- Naprawa: drugi telefon ze starym cache klika „Odepnij” gdy rekord już usunięty po stronie serwera.

CREATE OR REPLACE FUNCTION public.remove_friend_player_link(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_linked uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;

  SELECT linked_user_id INTO v_linked
  FROM public.players
  WHERE id = p_player_id AND owner_id = v_me;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.players
  SET linked_user_id = NULL
  WHERE id = p_player_id AND owner_id = v_me;

  IF v_linked IS NOT NULL THEN
    DELETE FROM public.players
    WHERE owner_id = v_linked AND linked_user_id = v_me;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_friend_player_link(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_friend_player_link(uuid) TO authenticated;
