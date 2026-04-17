-- 016_client_logs.sql
-- Tabela telemetryczna: klient zgłasza błędy sync, auth, RPC itp.
-- Dzięki temu zamiast zgadywać "dlaczego coś nie działa", zobaczymy to w bazie.
--
-- Uwagi RODO: zapisujemy tylko user_id (UUID), poziom, nazwę eventu,
-- krótki kontekst (np. kod błędu Postgresa), device (User-Agent),
-- wersję apki. NIE zapisujemy treści danych użytkownika ani IP.
-- Retencja: 90 dni (rekomendowane; kron/polityka do dodania w Fazie 3).

CREATE TABLE IF NOT EXISTS public.client_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id  TEXT,               -- korelacja eventów w obrębie jednej wizyty
  level       TEXT NOT NULL CHECK (level IN ('error','warn','info')),
  event       TEXT NOT NULL,      -- np. 'save_session_failed', 'realtime_error'
  context     JSONB NOT NULL DEFAULT '{}'::jsonb,
  device      TEXT,               -- navigator.userAgent (skrócony)
  app_version TEXT                -- hash commita lub wersja apki
);

CREATE INDEX IF NOT EXISTS client_logs_user_created_idx
  ON public.client_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS client_logs_event_created_idx
  ON public.client_logs (event, created_at DESC);

ALTER TABLE public.client_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated może wstawić tylko z własnym user_id (albo nullem, jeśli
-- np. błąd wyleciał przed zalogowaniem).
DROP POLICY IF EXISTS "client_logs_insert_own" ON public.client_logs;
CREATE POLICY "client_logs_insert_own"
  ON public.client_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Authenticated widzi tylko własne logi. Admin ma dostęp przez dashboard
-- (service_role omija RLS).
DROP POLICY IF EXISTS "client_logs_select_own" ON public.client_logs;
CREATE POLICY "client_logs_select_own"
  ON public.client_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Nikt nie może update ani delete przez klienta (logi są append-only).
-- Polityki DELETE/UPDATE celowo nieutworzone.
