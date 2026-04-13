-- 001_participations.sql
-- Denormalised per-user game history (populated when a linked player finishes a session)

create table if not exists participations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  player_name text not null,
  total_buy_in integer not null,  -- cents
  cash_out integer,               -- cents
  net_balance integer,            -- cents
  session_date timestamptz not null,
  total_pot integer not null,     -- cents
  created_at timestamptz default now(),
  unique (user_id, session_id)
);
