-- 031: Hardening dla client_logs (S3) + prevent_profile_email_change (S1).
--
-- S3: client_logs INSERT bez rate-limit / rozmiaru — możliwy spam tabeli
--     i side-channel info-leak jeśli klient wrzuca duży context.
--     Naprawa:
--       * CHECK na rozmiar context (4 KB JSON) i długość event/level/device.
--       * trigger sprawdza liczbę logów per użytkownik z ostatniej minuty.
--         Próg 120/min = ~2/s burst, mocno powyżej normalnej pracy.
--
-- S1: prevent_profile_email_change odpalał się tylko gdy auth.uid() IS NOT NULL.
--     Jeśli ścieżka admina (service_role) lub trigger bez auth.uid() obejdzie
--     check, email da się przepisać. Generalizujemy: blokujemy ZAWSZE zmianę
--     email — wyjątek tylko service_role (current_setting jwt claims role).

ALTER TABLE public.client_logs
  ADD COLUMN IF NOT EXISTS context_size int GENERATED ALWAYS AS (octet_length(context::text)) STORED;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_logs_context_size_cap') THEN
    ALTER TABLE public.client_logs
      ADD CONSTRAINT client_logs_context_size_cap CHECK (context_size <= 4096);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_logs_event_len') THEN
    ALTER TABLE public.client_logs
      ADD CONSTRAINT client_logs_event_len CHECK (char_length(event) BETWEEN 1 AND 80);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_logs_device_len') THEN
    ALTER TABLE public.client_logs
      ADD CONSTRAINT client_logs_device_len CHECK (device IS NULL OR char_length(device) <= 300);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_logs_app_version_len') THEN
    ALTER TABLE public.client_logs
      ADD CONSTRAINT client_logs_app_version_len CHECK (app_version IS NULL OR char_length(app_version) <= 80);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.client_logs_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent int;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO v_recent
  FROM public.client_logs
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '1 minute';
  IF v_recent >= 120 THEN
    RAISE EXCEPTION 'client_logs rate limit exceeded' USING ERRCODE = '53400';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_logs_rate_limit ON public.client_logs;
CREATE TRIGGER trg_client_logs_rate_limit
  BEFORE INSERT ON public.client_logs
  FOR EACH ROW EXECUTE FUNCTION public.client_logs_rate_limit();

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
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Email konta nie może być zmieniany po rejestracji.';
END;
$$;
