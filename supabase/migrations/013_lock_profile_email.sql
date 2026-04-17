-- 013: Prevent authenticated users from changing profile email after signup.
-- Email remains immutable in public.profiles for consistency with invites/linking.

CREATE OR REPLACE FUNCTION public.prevent_profile_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Email konta nie może być zmieniany po rejestracji.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_email_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_email_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
WHEN (NEW.email IS DISTINCT FROM OLD.email)
EXECUTE FUNCTION public.prevent_profile_email_change();
