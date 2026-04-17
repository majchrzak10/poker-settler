#!/usr/bin/env node
// Skrypt diagnostyczny Supabase dla Poker Settler.
// Uruchomienie:
//   SUPABASE_PAT=sbp_xxx node scripts/diagnose.mjs
// PAT wygenerujesz tu: https://supabase.com/dashboard/account/tokens
// Po użyciu — zrewokuj token.

const PAT = process.env.SUPABASE_PAT;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'oatfqrijmwdnkztgvzwx';

if (!PAT) {
  console.error('BŁĄD: brak SUPABASE_PAT.');
  console.error('Użycie: SUPABASE_PAT=sbp_xxx node scripts/diagnose.mjs');
  process.exit(1);
}

const API = 'https://api.supabase.com';

async function sql(query) {
  const res = await fetch(`${API}/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function fmtRows(rows) {
  if (!rows || rows.length === 0) return '  (brak wierszy)';
  return rows.map(r => '  ' + JSON.stringify(r)).join('\n');
}

async function section(title, query) {
  console.log(`\n━━━ ${title} ━━━`);
  try {
    const rows = await sql(query);
    console.log(fmtRows(rows));
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }
}

(async () => {
  console.log(`Diagnostyka projektu: ${PROJECT_REF}`);
  console.log(`Czas: ${new Date().toISOString()}`);

  await section(
    'A. Tabele w schemacie public',
    `select table_name from information_schema.tables
     where table_schema = 'public' order by table_name;`
  );

  await section(
    'B. Publikacja Realtime (KRYTYCZNE dla sync)',
    `select tablename from pg_publication_tables
     where pubname = 'supabase_realtime' order by tablename;`
  );

  await section(
    'C. Triggery (public + auth)',
    `select trigger_name, event_object_schema, event_object_table, action_timing, event_manipulation
     from information_schema.triggers
     where trigger_schema in ('public','auth')
     order by event_object_schema, event_object_table, trigger_name;`
  );

  await section(
    'D. RLS status na tabelach public',
    `select tablename, rowsecurity from pg_tables
     where schemaname = 'public' order by tablename;`
  );

  await section(
    'E. Polityki RLS (liczba per tabela)',
    `select tablename, count(*)::int as policies
     from pg_policies where schemaname = 'public'
     group by tablename order by tablename;`
  );

  await section(
    'F. Funkcje i RPC',
    `select routine_name, routine_type from information_schema.routines
     where routine_schema = 'public' order by routine_name;`
  );

  await section(
    'G. Orfany — liczby',
    `select 'players_bez_ownera' as co, count(*) as ile from players where owner_id is null
     union all select 'players_z_martwym_userem', count(*) from players p
       where p.linked_user_id is not null
       and not exists (select 1 from auth.users u where u.id = p.linked_user_id)
     union all select 'session_players_na_martwym_playerze', count(*) from session_players sp
       where not exists (select 1 from players p where p.id = sp.player_id)
     union all select 'stare_wiszace_zaproszenia_30d', count(*) from friend_invites
       where created_at < now() - interval '30 days' and status = 'pending';`
  );

  await section(
    'H. Liczebności głównych tabel',
    `select 'auth.users' as tabela, count(*) as wierszy from auth.users
     union all select 'profiles', count(*) from profiles
     union all select 'players', count(*) from players
     union all select 'sessions', count(*) from sessions
     union all select 'session_players', count(*) from session_players
     union all select 'transfers', count(*) from transfers
     union all select 'participations', count(*) from participations
     union all select 'friend_invites', count(*) from friend_invites
     union all select 'live_session_state', count(*) from live_session_state;`
  );

  console.log('\n━━━ KONIEC. Skopiuj cały output i wklej w czacie. ━━━');
})().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
