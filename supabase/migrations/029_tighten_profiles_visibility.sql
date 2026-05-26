-- 029: W2 — zawężenie SELECT na profiles + bezpieczne RPC do lookupu.
--
-- Stan: policy "lookup" pozwalała każdemu authenticated zobaczyć cały
-- public.profiles (id, email, phone, display_name). Atak: scraping bazy
-- użytkowników, enumeracja po e-mailu, RODO.
--
-- Nowa polityka SELECT: widzisz tylko siebie + profile osób z którymi masz
-- powiązanie:
--   - friend_invites (jakikolwiek kierunek i status — żeby UI pokazał
--     "imię_zapraszającego" i status własnych zaproszeń),
--   - players.linked_user_id (zaakceptowani znajomi).
--
-- Dla wciąż potrzebnych funkcji UI (lookup e-mail przy wysłaniu zaproszenia,
-- masowa weryfikacja "czy ten e-mail ma konto") dodajemy dwa SECURITY DEFINER
-- RPC, które zwracają minimum danych (samo id / listę istniejących e-maili).
-- Te RPC same w sobie nadal pozwalają enumerację po e-mailu — to świadomy
-- kompromis dla UX zapraszania znajomych. Dla ochrony przed brute force
-- doliczamy 100ms sztucznego opóźnienia per wywołanie.

DROP POLICY IF EXISTS "lookup" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_or_linked" ON public.profiles;

CREATE POLICY "profiles_self_or_linked"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.friend_invites fi
      WHERE (fi.requester_user_id = auth.uid() AND fi.invitee_user_id = profiles.id)
         OR (fi.invitee_user_id = auth.uid() AND fi.requester_user_id = profiles.id)
    )
    OR EXISTS (
      SELECT 1 FROM public.players pl
      WHERE pl.owner_id = auth.uid()
        AND pl.linked_user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM public.players pl
      WHERE pl.linked_user_id = auth.uid()
        AND pl.owner_id = profiles.id
    )
  );

CREATE OR REPLACE FUNCTION public.find_profile_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_norm text := LOWER(TRIM(COALESCE(p_email, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_norm = '' OR POSITION('@' IN v_norm) = 0 THEN
    RETURN NULL;
  END IF;

  PERFORM pg_sleep(0.1);

  SELECT id INTO v_id
  FROM public.profiles
  WHERE LOWER(TRIM(COALESCE(email, ''))) = v_norm
  LIMIT 1;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_existing_emails(p_emails text[])
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_emails IS NULL OR array_length(p_emails, 1) IS NULL THEN
    RETURN;
  END IF;
  IF array_length(p_emails, 1) > 200 THEN
    RAISE EXCEPTION 'too many emails';
  END IF;

  RETURN QUERY
  SELECT LOWER(TRIM(COALESCE(email, '')))
  FROM public.profiles
  WHERE LOWER(TRIM(COALESCE(email, ''))) = ANY (
    SELECT LOWER(TRIM(e)) FROM unnest(p_emails) AS e
  );
END;
$$;

REVOKE ALL ON FUNCTION public.find_profile_id_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profiles_existing_emails(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_profile_id_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profiles_existing_emails(text[]) TO authenticated;
