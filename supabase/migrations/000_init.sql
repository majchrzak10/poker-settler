-- 000_init.sql
-- Core tables for Poker Settler

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz default now()
);

create table if not exists players (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  linked_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (owner_id, linked_user_id)
);

create table if not exists sessions (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  played_at timestamptz not null,
  total_pot integer not null default 0, -- cents
  created_at timestamptz default now()
);

create table if not exists session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  player_name text not null,
  total_buy_in integer not null default 0, -- cents
  cash_out integer,                         -- cents, null if not yet settled
  net_balance integer,                      -- cents, cash_out - total_buy_in
  created_at timestamptz default now()
);

create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  from_name text not null,
  to_name text not null,
  amount integer not null, -- cents
  created_at timestamptz default now()
);
