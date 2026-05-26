-- 032: Fix regression in 031 — prevent_profile_email_change was too strict.
--
-- 031 made the trigger reject every UPDATE that changes profiles.email
-- unless the caller is service_role. That accidentally blocks legitimate
-- server-side flows:
--   * handle_new_user signup trigger (ON CONFLICT DO UPDATE SET email)
--   * any future SECURITY DEFINER function that legitimately needs to set
--     the email for the user it owns
--
-- Restored semantics: block only when an authenticated end-user (JWT role
-- 'authenticated') is changing email. service_role and contexts without
-- JWT (server-side triggers, postgres superuser) are allowed — same as
-- the original 013 behavior, expressed explicitly.

CREATE OR REPLACE FUNCTION public.prevent_profile_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb)->>'role',
    ''
  );
  IF v_role = 'authenticated' THEN
    RAISE EXCEPTION 'Email konta nie może być zmieniany po rejestracji.';
  END IF;
  RETURN NEW;
END;
$$;
