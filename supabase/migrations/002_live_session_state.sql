-- Live draft synchronisation for active (unsaved) session across devices.
-- Run after 000/001 migrations.

CREATE TABLE IF NOT EXISTS public.live_session_state (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_buy_in integer NOT NULL DEFAULT 50,
  session_players jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_session_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_session_select_own" ON public.live_session_state;
DROP POLICY IF EXISTS "live_session_insert_own" ON public.live_session_state;
DROP POLICY IF EXISTS "live_session_update_own" ON public.live_session_state;
DROP POLICY IF EXISTS "live_session_delete_own" ON public.live_session_state;

CREATE POLICY "live_session_select_own"
ON public.live_session_state
FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "live_session_insert_own"
ON public.live_session_state
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "live_session_update_own"
ON public.live_session_state
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "live_session_delete_own"
ON public.live_session_state
FOR DELETE
USING (auth.uid() = owner_id);
