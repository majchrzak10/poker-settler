# Kontekst projektu — handoff dla ludzi i AI

**Cel:** jedna strona, żeby nowa osoba lub asystent AI od razu rozumiał(a) *dlaczego* kod tak wygląda i *czego nie psuć*. Szczegóły techniczne są w `CLAUDE.md`, plan długoterminowy w `docs/PLAN.md`, checklista Supabase w `docs/SUPABASE_CHECKLIST.md`.

**Repo:** `majchrzak10/poker-settler` · **Deploy:** Netlify z gałęzi `main` (statyczne pliki, bez buildu w pipeline — patrz `netlify.toml`).

---

## 1. Czym jest aplikacja

**Poker Settler** — polskojęzyczna PWA do rozliczania puli po grze w pokera: buy-iny, cash-outy, minimalna lista przelewów (`settleDebts` w `src/lib/settlement.ts`).

- **UI:** Vite + React 18 + TypeScript — główny komponent w `src/App.tsx` (docelowo podział na moduły); build statyczny do `dist/`.
- **Backend:** Supabase (Auth + Postgres + Realtime). Kwoty w bazie: **centy (integer)**; w UI: PLN float — konwersja przy granicy (`plnToCents` / odczyt).
- **Stan:** React w `App`, props w dół; persystencja: **localStorage + Supabase** (dual-write przy zalogowanym użytkowniku).

---

## 2. Diagnoza problemów ze „synchronizacją” (2026)

To nie był jeden bug, tylko kilka warstw:

| Problem | Skutek | Mitigacja w repo |
|--------|--------|-------------------|
| **Publikacja Realtime** w prod miała tylko część tabel (np. sam `live_session_state`) | Zapis w chmurze był, ale drugi telefon **nie dostawał** eventów Realtime — wrażenie „sesji nie ma” | Migracja **014** (`014_realtime_add_all_tables.sql`) dopina tabele do `supabase_realtime`. **W prod trzeba było wykonać SQL ręcznie**, jeśli migracje nie szły przez CLI. |
| **Brak wiersza `profiles` / self-`players`** dla starszych kont | „Konta w niebycie”, niespójność z założeniem **user = player** | **015** — backfill + rozszerzony `handle_new_user`. |
| **Rozproszona logika sync** (~50+ wywołań Supabase w jednym pliku) | Wyścigi, część zapisów tylko w LS, trudny debug | Plan **Fazy 2:** Vite + TS + jeden moduł sync (`docs/PLAN.md`). |
| **FK `session_players` → `players`** przy usuwaniu gracza | Błąd przy usuwaniu starych testowych graczy | **017** — `ON DELETE SET NULL`, `player_id` nullable (nazwa zostaje w `player_name`). |
| **RPC `remove_friend_player_link`** rzucało przy już usuniętym wierszu | Na jednym urządzeniu OK, na drugim „Nie znaleziono gracza” (stary cache) | **018** — funkcja idempotentna; w kliencie po błędzie RPC wywołanie `refreshCloudData()`. |

**Źródło prawdy (decyzja produktowa):** **Supabase**; localStorage = cache offline + kolejka retry. Pełna jednolita implementacja „najpierw chmura” jest celem Fazy 1/2 w `PLAN.md`, nie zawsze jest już w 100% wdrożona w każdej ścieżce w `index.html` — przy zmianach sprawdzaj krytyczne flow (zapis sesji, refresh po `visibilitychange`).

---

## 3. Skrót migracji SQL (`supabase/migrations/`)

Kolejność wg numerów plików. **Uwaga:** są **dwa pliki `005_*`** — przy ręcznym wgrywaniu upewnij się, że **oba** zostały wykonane.

| Nr | Plik | Krótko |
|----|------|--------|
| 000 | `000_profiles_players_participations.sql` | Baseline profiles / players / participations, RLS |
| 001 | `001_session_atomic.sql` | RPC `save_session_atomic` / `update_session_atomic` |
| 002 | `002_live_session_state.sql` | Draft sesji na żywo |
| 003 | `003_profile_on_signup.sql` | Trigger profilu przy rejestracji (`handle_new_user`) |
| 004 | `004_realtime_live_session_state.sql` | Realtime dla `live_session_state` |
| 005a | `005_phone_and_friend_unique.sql` | Unikalność telefonu / znajomych |
| 005b | `005_profiles_backfill_and_link_index.sql` | Backfill profili + indeks `(owner_id, linked_user_id)` |
| 006 | `006_find_profile_by_phone.sql` | RPC szukania profilu po telefonie |
| 007 | `007_rls_players_profiles_fix.sql` | Poprawki RLS |
| 008 | `008_realtime_players_sessions.sql` | Realtime dla players/sessions/… (starsza wersja; patrz 014) |
| 009 | `009_friend_link_rpc.sql` | `complete_friend_player_link` / `remove_friend_player_link` |
| 010 | `010_friend_invites_with_acceptance.sql` | Zaproszenia znajomych |
| 011 | `011_self_player_sync_helpers.sql` | Pomocnicze RPC self-playera |
| 012 | `012_cancel_friend_invite.sql` | `cancel_friend_invite` |
| 013 | `013_lock_profile_email.sql` | Email w `profiles` niezmienny po rejestracji |
| 014 | `014_realtime_add_all_tables.sql` | **Krytyczne:** pełna publikacja Realtime pod sync między urządzeniami |
| 015 | `015_backfill_user_player.sql` | Backfill profili + self-player; trigger user=player |
| 016 | `016_client_logs.sql` | Telemetria `client_logs` (RLS) |
| 017 | `017_session_players_fk_set_null.sql` | FK przy usuwaniu gracza |
| 018 | `018_idempotent_remove_friend_link.sql` | Idempotentne odpinanie znajomego |
| 019 | `019_players_unique_phone_per_owner.sql` | Unikalny numer (9 cyfr) wśród `players` u tego samego `owner_id` |

Skrypt **`scripts/diagnose.mjs`** (wymaga `SUPABASE_PAT` z dashboardu Supabase) — szybki przegląd tabel, publikacji Realtime, RLS, orfanów (bez logowania sekretów do repo).

---

## 4. Tabele i pojęcia

- **`profiles`** — email, display_name; powiązane z `auth.users.id`.
- **`players`** — gracz w kontekście **właściciela** (`owner_id`); `linked_user_id` łączy z kontem znajomego.
- **`sessions`**, **`session_players`**, **`transfers`**, **`participations`** — zakończone sesje i rozliczenia.
- **`live_session_state`** — draft bieżącej gry (sync na żywo).
- **`friend_invites`** — zaproszenia (invite-only flow).
- **`client_logs`** — zdarzenia klienta (błędy sync itd.), RLS: user widzi tylko swoje.

**Założenie „user = player”:** każdy zarejestrowany użytkownik powinien mieć **self-playera** (`owner_id = linked_user_id = user.id`). Realizacja: trigger w **015** + logika w kliencie.

---

## 5. Co jest zrobione vs co jest w planie

| Stan | Opis |
|------|------|
| **Zrobione (ok. Faza 1)** | Migracje 014–018, telemetria, twardniejszy auth/realtime w kliencie, dokumentacja, `diagnose.mjs`; wiele hotfixów w `index.html` (m.in. reconnect, naprawy FK, idempotent unlink). |
| **Plan (Faza 2 — w toku)** | Szkielet Vite + TS jest; kolejny krok: rozbicie `App.tsx`, warstwa `sync/`, typy Supabase — `docs/PLAN.md` sekcja 4. |
| **Dev / deploy** | Lokalnie: `npm run dev`; produkcja: `npm run build` → Netlify publikuje `dist/` (patrz `netlify.toml`). |

---

## 6. Bezpieczeństwo i sekrety

- W repozytorium i w **`index.html`** może być tylko **klucz publiczny (anon / publishable)** Supabase — **nigdy** `service_role` ani **sekret** konta.
- **PAT** (`sbp_…`) do Management API i skryptów — tylko lokalnie / CI, rotacja po użyciu.
- **Nie wklejaj** pełnych kluczy do czatu z AI ani do commitów.

---

## 7. Jak pracować z tym repozytorium (dla AI)

1. Przeczytaj **`CLAUDE.md`** (architektura plików) + **ten plik**.
2. Przy zmianach w bazie: znajdź migrację lub dodaj **nowy numerowany plik** w `supabase/migrations/`; opisz w `README.md` jeśli zmieniasz kolejność wdrożeń.
3. Logika rozliczeń: **`src/lib/settlement.ts`** + `npm test` (Vitest) — nie duplikuj formuł w UI.
4. Po zmianach w sync: smoke na **dwóch urządzeniach** lub przynajmniej dwie sesje przeglądarki + sprawdzenie `client_logs` w SQL.

---

## 8. Historia tego dokumentu

- **2026-04-17** — pierwsza wersja: skondensowany handoff po pracach nad sync, migracjami 014–018 i rozmowami z właścicielem.
