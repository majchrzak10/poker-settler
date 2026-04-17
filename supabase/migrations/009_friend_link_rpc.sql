-- 009: Powiązania znajomych wyłącznie przez RPC (SECURITY DEFINER).
-- Eliminuje błędy RLS przy INSERT „lustra” w players (owner_id = znajomy).
-- Klient wywołuje tylko complete_friend_player_link / remove_friend_player_link.

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
END;
$$;

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
    RAISE EXCEPTION 'Nie znaleziono gracza.';
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

REVOKE ALL ON FUNCTION public.complete_friend_player_link(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_friend_player_link(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_friend_player_link(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend_player_link(uuid) TO authenticated;
