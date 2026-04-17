# Checklista Supabase — diagnostyka przed Fazą 1

Dokument dla właściciela. Krok po kroku — kopiujesz wyniki z panelu
Supabase i wklejasz do czatu, albo robisz screeny.

**Project URL z kodu:** `https://oatfqrijmwdnkztgvzwx.supabase.co`
(ten sam widnieje w `index.html:82`).

---

## 1. Ile masz projektów Supabase?

- Wejdź na https://supabase.com/dashboard
- Policz projekty na liście
- **Potwierdź, że ten z URL powyżej to jedyny / ten używany przez prod**

---

## 2. Stan migracji

- Supabase → SQL Editor → nowy query
- Uruchom:

```sql
select version from supabase_migrations.schema_migrations order by version;
```

- Wklej wynik. Oczekiwane wartości: `000`, `001`, `002`, `003`, `004`,
  `005_phone_and_friend_unique`, `005_profiles_backfill_and_link_index`,
  `006`, `007`, `008`, `009`, `010`, `011`, `012`, `013`.
- Jeśli którejś brakuje — to jest nasz winowajca.

---

## 3. Publikacja Realtime

- SQL Editor:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
```

- Oczekiwane tabele: `players`, `sessions`, `session_players`, `transfers`,
  `live_session_state`, `participations`, `friend_invites`.
- Jeśli czegoś nie ma — Realtime dla tej tabeli po prostu *nie działa* i
  tłumaczy to objawy „stare dane po wznowieniu".

---

## 4. RLS i polityki

- SQL Editor:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

- Każda tabela public powinna mieć `rowsecurity = true`.

Oraz:

```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

- Wklej wynik — zweryfikujemy czy polityki nie blokują legit zapisów.

---

## 5. Orfany i niespójności danych

Ile jest kont-duchów i niespójności:

```sql
-- players bez właściciela
select count(*) from players where owner_id is null;

-- players wskazujące na nieistniejącego usera
select count(*) from players p
where p.linked_user_id is not null
  and not exists (select 1 from auth.users u where u.id = p.linked_user_id);

-- session_players wskazujące na nieistniejącego playera
select count(*) from session_players sp
where not exists (select 1 from players p where p.id = sp.player_id);

-- wiszące zaproszenia starsze niż 30 dni
select count(*) from friend_invites
where created_at < now() - interval '30 days'
  and status = 'pending';
```

---

## 6. Netlify env vars

- Netlify → Site settings → Environment variables
- **Sprawdź czy są ustawione** `SUPABASE_URL` i `SUPABASE_KEY` (anon).
- Jeśli nie — nie szkodzi, bo są hardkodowane w `index.html:82-83`, ale
  docelowo (Faza 2) powinny być w env.

---

## 7. Backup bazy PRZED Fazą 1

**Ważne.** Zanim zaczniemy cokolwiek poprawiać:

- Supabase → Database → Backups → **Create backup on demand**
- Nazwij `before-faza1-2026-04-17`
- Tylko wtedy mogę spokojnie uruchomić skrypty czyszczące orfany.

---

## 8. Rotacja klucza secret

Jeśli wkleiłeś gdziekolwiek `sb_secret_...`:

- Supabase → Project Settings → API Keys → Secret keys
- Kliknij Revoke przy starym kluczu
- Wygeneruj nowy
- Trzymaj tylko lokalnie, nigdy w repo, w czacie ani w kodzie apki
