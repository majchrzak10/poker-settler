-- Realtime dla live_session_state (synchronizacja szkicu między urządzeniami).
-- Bezpieczne wielokrotne uruchomienie.

DO $m$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_session_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_session_state;
  END IF;
END
$m$;
