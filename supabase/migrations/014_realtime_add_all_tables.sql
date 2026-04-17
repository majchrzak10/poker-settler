-- 014_realtime_add_all_tables.sql
-- Naprawa sync między urządzeniami.
--
-- Diagnoza z 2026-04-17: w publikacji supabase_realtime była TYLKO tabela
-- live_session_state, mimo że migracje 008 i 010 miały dodać też players,
-- sessions, session_players, transfers, participations i friend_invites.
-- Efekt: zapis na telefonie A nie był powiadamiany na telefonie B przez
-- Realtime, co tłumaczyło objaw "stare dane po wznowieniu/refresh".
--
-- Ta migracja idempotentnie dodaje brakujące tabele do publikacji.

do $$
declare
  t text;
  tables text[] := array[
    'players',
    'sessions',
    'session_players',
    'transfers',
    'participations',
    'friend_invites'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
