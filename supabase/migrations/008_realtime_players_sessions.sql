-- Realtime: broadcast INSERT/UPDATE/DELETE so klient dostaje postgres_changes
-- (wcześniej tylko live_session_state było w publikacji — Gracze/Historia „nie żyły”).

DO $m$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'session_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_players;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transfers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'participations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participations;
  END IF;
END
$m$;
