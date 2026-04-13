# Poker Settler

Polskojęzyczna PWA do rozliczania gier pokerowych między znajomymi: buy-iny, cash-outy, minimalizacja przelewów, historia, konto w chmurze (Supabase).

## Architektura

- **Jeden plik frontendu:** [`index.html`](index.html) — React 18 (UMD production), Babel Standalone (JSX w przeglądarce), Tailwind CDN, Supabase JS v2.
- **Backend:** Supabase (Auth + Postgres + opcjonalnie Realtime).
- **Persystencja lokalna:** `localStorage` (offline / przed logowaniem).
- **Persystencja chmurowa:** tabele `profiles`, `players`, `sessions`, `session_players`, `transfers`, `participations`, `live_session_state`.

Szczegóły dla asystentów AI: [`CLAUDE.md`](CLAUDE.md).

## Wymagania

- Przeglądarka z JS.
- Konto i projekt **Supabase** (URL + klucz publikowany w kliencie).
- (Opcjonalnie) **Netlify** lub inny hosting statyczny.

## Konfiguracja Supabase

### 1. Migracje SQL — kolejność

Uruchamiaj w **Supabase → SQL → New query** w podanej kolejności:

| Kolejność | Plik | Opis |
|-----------|------|------|
| 1 | [`supabase/migrations/000_profiles_players_participations.sql`](supabase/migrations/000_profiles_players_participations.sql) | `profiles.email`, `players.linked_user_id`, tabela `participations` + RLS |
| 2 | [`supabase/migrations/001_session_atomic.sql`](supabase/migrations/001_session_atomic.sql) | Funkcje `save_session_atomic` / `update_session_atomic` (transakcyjny zapis sesji) |
| 3 | [`supabase/migrations/002_live_session_state.sql`](supabase/migrations/002_live_session_state.sql) | Tabela `live_session_state` — synchronizacja **aktywnej** (niezapisanej) sesji między urządzeniami |

Jeśli polityka już istnieje (`policy already exists`), w pliku `000` są `DROP POLICY IF EXISTS` — możesz bezpiecznie ponowić fragment RLS.

### 2. Realtime (zalecane)

Aby odświeżanie między urządzeniami działało „na żywo”, w Supabase włącz replikację Realtime dla tabel używanych w kanale (min.):

- `players`
- `sessions`
- `session_players`
- `transfers`
- `participations`
- `live_session_state`

**Database → Replication** (lub odpowiednik w panelu) — zaznacz te tabele.

Bez Realtime aplikacja nadal działa, ale częściej polega na pollingu / focus.

### 3. Klucze w `index.html`

W [`index.html`](index.html) ustaw:

- `SUPABASE_URL`
- `SUPABASE_KEY` (klucz **publikowalny** / anon — zgodnie z polityką Supabase; bezpieczeństwo danych = **RLS**)

## Uruchomienie lokalne

1. Otwórz `index.html` w przeglądarce **lub** serwuj katalogiem statycznym, np.:

```bash
cd "/Users/jan/Downloads/Poker cursor"
python3 -m http.server 8080
```

2. Wejdź na `http://localhost:8080`.

## Wdrożenie (Netlify)

1. **Publish directory:** katalog z `index.html` (np. root repo).
2. **Build command:** puste (brak builda).
3. Podłącz domenę w **Domain management** (np. `bioredlab.pl`).
4. Po każdej zmianie wgraj nowy `index.html` lub zrób deploy z Gita.

## Funkcje (skrót)

- Logowanie / rejestracja (Supabase Auth).
- Baza graczy, sesja (buy-iny), rozliczenie, zapis sesji.
- Historia + ranking; edycja / usunięcie sesji (właściciel) z synchronizacją do chmury.
- Połączenie gracza z kontem (email / UUID) → wpisy `participations` i współdzielony podgląd historii.
- Kolejka nieudanych zapisów chmurowych + ponowienie + auto-retry.
- Synchronizacja draftu sesji: `live_session_state` + Realtime.

## Test smoke (po wdrożeniu)

1. Rejestracja / logowanie.
2. Dodanie gracza, sesja, rozliczenie, **zakończenie i zapis** — wiersze w `sessions` / `session_players`.
3. **Profil** → synchronizacja bez błędu po zapisie.
4. (Opcjonalnie) dwa urządzenia, to samo konto — zmiana aktywnej sesji widoczna na drugim (po migracji `002` i Realtime).

## Struktura repozytorium

```
.
├── index.html                      # cała aplikacja (React + logika)
├── CLAUDE.md                       # notatki dla asystentów AI
├── README.md                       # ten plik
└── supabase/migrations/
    ├── 000_profiles_players_participations.sql
    ├── 001_session_atomic.sql
    └── 002_live_session_state.sql
```

## Repozytorium na GitHubie

Lokalnie (w tym katalogu):

```bash
cd "/Users/jan/Downloads/Poker cursor"
git init
git add .
git commit -m "Initial commit: Poker Settler"
```

Jeśli **GitHub CLI** (`gh`) jest zalogowany:

```bash
gh auth login -h github.com
gh repo create poker-settler --public --source=. --remote=origin --push
```

Bez `gh`: utwórz puste repo na GitHubie, potem:

```bash
git remote add origin https://github.com/TWOJ_USER/poker-settler.git
git branch -M main
git push -u origin main
```

## Licencja

Ustal według własnych potrzeb (repo domyślnie bez licencji — dodaj plik `LICENSE` jeśli chcesz jawnie udostępniać kod).
