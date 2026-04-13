-- Baseline: profiles.email, players.linked_user_id, participations + RLS
-- Uruchom przed 001_session_atomic.sql (albo scal z jednym plikiem w tej kolejności).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE players ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS participations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  session_id UUID NOT NULL,
  player_name TEXT NOT NULL,
  total_buy_in INTEGER NOT NULL DEFAULT 0,
  cash_out INTEGER,
  net_balance INTEGER GENERATED ALWAYS AS (
    CASE WHEN cash_out IS NOT NULL THEN cash_out - total_buy_in ELSE NULL END
  ) STORED,
  session_date TIMESTAMPTZ NOT NULL,
  total_pot INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_any" ON participations;
DROP POLICY IF EXISTS "select_own" ON participations;

-- Uwaga bezpieczeństwa: każdy zalogowany użytkownik może wstawić dowolny user_id.
-- To jest typowe, jeśli organizator zapisuje udział znajomych z poziomu klienta.
-- Silniejszy wariant: tylko zapis przez RPC (SECURITY DEFINER) i polityka INSERT wyłączona dla authenticated.
CREATE POLICY "insert_any" ON participations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "select_own" ON participations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "lookup" ON profiles;

-- Każdy authenticated widzi wszystkie profile (potrzebne do linkowania po emailu / ID).
-- Świadomy kompromis prywatności w małej aplikacji.
CREATE POLICY "lookup" ON profiles FOR SELECT TO authenticated USING (true);
