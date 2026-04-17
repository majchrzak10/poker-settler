# Poker Settler

Aplikacja PWA do rozliczania pokerowych sesji ze znajomymi. Wpisz buy-iny, wpisz cash-outy — dostaniesz minimalną listę przelewów.

## Architektura

Aplikacja buduje się **Vite** (`npm run build` → katalog **`dist/`**). Kod UI: **React 18 + TypeScript** w `src/` (główny plik: `src/App.tsx`; logika rozliczeń: `src/lib/settlement.ts`). Wymagany **Node.js** do developmentu i builda.

| Warstwa | Technologia |
|---------|-------------|
| UI | React 18 + Vite (bundler) |
| Styl | Tailwind CSS (PostCSS) |
| Backend | Supabase (auth + PostgreSQL) |
| Offline | localStorage (fallback gdy brak konta) |

Kwoty w Supabase są przechowywane jako **centy (integer)**. UI pracuje na PLN (float) — przeliczenie przy zapisie/odczycie.

## Konfiguracja Supabase

1. Utwórz projekt na [supabase.com](https://supabase.com).
2. Skonfiguruj klienta Supabase (domyślnie wartości są w `src/config.ts`):
   - **Lokalnie / Netlify:** ustaw zmienne środowiskowe `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` (anon / publishable key — ten sam co wcześniej w `index.html`).
   - Bez zmiennych build użyje placeholderów z `config.ts` (wygodne na start; w produkcji lepiej nadpisać env).
3. Uruchom migracje **po kolei** w **SQL Editor** (Supabase Dashboard), pliki z `supabase/migrations/`:
   `000` … `019` (m.in. **007** RLS, **008** Realtime, **009** RPC znajomi, **010–012** zaproszenia, **013** email, **014** pełna publikacja Realtime, **015** backfill profil/self-player, **016** `client_logs`, **017** FK `session_players` → `SET NULL` przy usuwaniu gracza, **018** idempotentne `remove_friend_player_link`, **019** unikalny numer telefonu wśród graczy u danego właściciela).
   Dla starszych baz szczególnie ważne są: **003** (trigger profilu), **005** (backfill profili), **009/010/012**, **013**, **014** (sync między urządzeniami), **015–019** (spójność kont, usuwanie / odpinanie, telefony).
   Migracja **003** dodaje trigger: przy rejestracji od razu powstaje wiersz w `profiles` z emailem. Jeśli masz już własny trigger z panelu Supabase, uruchom skrypt świadomie (może nadpisać funkcję `handle_new_user`).
4. Realtime: migracja **008** dopisuje tabele do publikacji `supabase_realtime`; jeśli wdrażasz ręcznie starszą bazę, w Dashboard → **Database → Publications** upewnij się, że te tabele są w replikacji (jak w **008**).

## Lokalny development

```bash
npm install
npm run dev
# → http://localhost:5173 (Vite)
```

## Testy

```bash
npm test
```

Uruchamia **Vitest** na [src/lib/settlement.test.ts](src/lib/settlement.test.ts) (logika z [src/lib/settlement.ts](src/lib/settlement.ts)).

## Deploy (Netlify)

W repozytorium jest **`netlify.toml`**: **`npm run build`** → publikacja katalogu **`dist/`**.

**Checklist w Netlify (Dashboard → site → Build & deploy):**

1. **Continuous deployment** — repozytorium GitHub, gałąź **`main`**.
2. **Build settings** — *Build command* `npm run build`, *Publish directory* **`dist`** (może nadpisać UI; plik `netlify.toml` też to ustawia).
3. **Environment variables (opcjonalnie):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — jeśli nie chcesz polegać na domyślnych wartościach w `src/config.ts`.
4. Po zapisie każdy **`git push origin main`** uruchamia build i deploy.

### Netlify podpięte do GitHuba (zalecane)

Po **Import from Git** każdy push na **`main`** uruchamia deploy automatycznie (to jest domyślna ścieżka — nie trzeba GitHub Actions).

```bash
git add -A
git commit -m "Krótki opis zmian"
git push origin main
```

### Inaczej (CLI)

```bash
npm run build
netlify deploy --prod --dir dist
```

## Smoke test po wdrożeniu

1. Otwórz aplikację → ekran logowania powinien się pojawić.
2. Utwórz konto → zaloguj się.
3. Dodaj 2 graczy (zakładka **Gracze**).
4. Przejdź do **Sesji**, ustaw buy-in, dodaj graczy.
5. Przejdź do **Wyników**, wpisz cash-outy (suma = pula), kliknij **Oblicz**.
6. Zapisz sesję → sprawdź zakładkę **Historia**.
7. W Supabase Dashboard → Table Editor zweryfikuj wpisy w `sessions` i `transfers`.

### Smoke test: 2 konta / 2 telefony (znajomi + sesja)

1. Na telefonie A zaloguj KontoA, na telefonie B zaloguj KontoB.
2. W KontoA dodaj gracza i połącz go z KontoB (email lub ID z Profilu).
3. Sprawdź na KontoB w sekcji **Znajomi**, czy KontoA pojawia się automatycznie.
4. W KontoA odepnij link i potwierdź, że zniknął po obu stronach.
5. Na obu kontach zamknij aplikację, otwórz ponownie — konto ma pozostać zalogowane.
6. Użyj ręcznego wylogowania i potwierdź, że wraca ekran logowania.

## Struktura katalogów

```
index.html                        ← punkt wejścia Vite
src/
  main.tsx                        ← mount React + PWA
  App.tsx                         ← aplikacja (Supabase, zakładki)
  lib/settlement.ts               ← rozliczenia (wspólne z testami)
  lib/settlement.test.ts          ← Vitest
vite.config.ts
tailwind.config.js
CLAUDE.md                         ← wskazówki dla AI / Claude Code
docs/CONTEXT.md                   ← handoff kontekstowy
supabase/
  migrations/
    000_profiles_players_participations.sql  ← tabele bazowe + RLS
    001_session_atomic.sql                   ← funkcje SECURITY DEFINER dla atomowego zapisu sesji
    002_live_session_state.sql               ← synchronizacja aktywnej sesji między urządzeniami
    003_profile_on_signup.sql                ← trigger: profil + email przy rejestracji (łączenie kont)
    004_realtime_live_session_state.sql      ← dodanie live_session_state do publikacji Realtime
    005_profiles_backfill_and_link_index.sql ← backfill starych profili + indeks dla linkowania wzajemnego
```

## GitHub

```bash
gh auth login -h github.com
gh repo create poker-settler --public --source=. --remote=origin --push
```

lub ręcznie:

```bash
git remote add origin https://github.com/TWOJ_USER/NAZWA_REPO.git
git push -u origin main
```
