-- 011: Self-player helpers for faster lookup and consistent profile sync

-- Fast lookups used by UI sync (owner list, linked account match, and email match)
CREATE INDEX IF NOT EXISTS players_owner_linked_idx
  ON public.players (owner_id, linked_user_id);

CREATE INDEX IF NOT EXISTS players_owner_email_idx
  ON public.players (owner_id, lower(email));

-- Keep a single helper RPC that upserts/refreshes the self player row.
-- The app can call this to ensure owner appears in sessions without duplicates.
CREATE OR REPLACE FUNCTION public.sync_self_player()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_player_id uuid;
  v_name text;
  v_email text;
  v_phone text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;

  SELECT
    COALESCE(
      NULLIF(TRIM(display_name), ''),
      NULLIF(SPLIT_PART(LOWER(TRIM(COALESCE(email, ''))), '@', 1), ''),
      'Ja'
    ),
    LOWER(TRIM(COALESCE(email, ''))),
    NULLIF(TRIM(COALESCE(phone, '')), '')
  INTO v_name, v_email, v_phone
  FROM public.profiles
  WHERE id = v_me
  LIMIT 1;

  SELECT id
    INTO v_player_id
  FROM public.players
  WHERE owner_id = v_me
    AND linked_user_id = v_me
  LIMIT 1;

  IF v_player_id IS NULL THEN
    v_player_id := gen_random_uuid();
    INSERT INTO public.players (id, owner_id, linked_user_id, name, email, phone)
    VALUES (v_player_id, v_me, v_me, v_name, NULLIF(v_email, ''), v_phone)
    ON CONFLICT (owner_id, linked_user_id) DO UPDATE
      SET name = EXCLUDED.name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone;
  ELSE
    UPDATE public.players
    SET name = v_name,
        email = NULLIF(v_email, ''),
        phone = v_phone
    WHERE id = v_player_id;
  END IF;

  RETURN v_player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_self_player() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_self_player() TO authenticated;
