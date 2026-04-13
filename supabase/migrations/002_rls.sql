-- 002_rls.sql
-- Row Level Security — each user sees only their own data

alter table profiles        enable row level security;
alter table players         enable row level security;
alter table sessions        enable row level security;
alter table session_players enable row level security;
alter table transfers       enable row level security;
alter table participations  enable row level security;

-- profiles: own row only
create policy "profiles: own row" on profiles
  for all using (id = auth.uid());

-- players: owned by current user
create policy "players: owner" on players
  for all using (owner_id = auth.uid());

-- sessions: owned by current user
create policy "sessions: owner" on sessions
  for all using (owner_id = auth.uid());

-- session_players: readable/writable through parent session
create policy "session_players: owner" on session_players
  for all using (
    session_id in (select id from sessions where owner_id = auth.uid())
  );

-- transfers: readable/writable through parent session
create policy "transfers: owner" on transfers
  for all using (
    session_id in (select id from sessions where owner_id = auth.uid())
  );

-- participations: own rows + sessions where you are a linked player
create policy "participations: own" on participations
  for all using (user_id = auth.uid());

-- Realtime: enable for tables that need live sync
-- Run in Supabase dashboard: Database → Replication → select tables below
-- Tables: players, sessions, session_players, transfers, participations
