# Poker Settler

Aplikacja PWA do rozliczania pokerowych sesji ze znajomymi. Wpisz buy-iny, wpisz cash-outy — dostaniesz minimalną listę przelewów.

## Architektura

Interfejs to **`index.html`** (React z CDN, Babel w przeglądarce) oraz **`lib/settlement.js`** — współdzielona logika rozliczeń (ładowana przed głównym skryptem). **Nie ma kroku build ani `npm install` do uruchomienia aplikacji.** W repozytorium jest `package.json` wyłącznie pod **`npm test`** (testy jednostkowe logiki w Node).

| Warstwa | Technologia |
|---------|-------------|
| UI | React 18 (CDN) + Babel Standalone (transpilacja JSX w przeglądarce) |
| Styl | Tailwind CSS (CDN) |
| Backend | Supabase (auth + PostgreSQL) |
| Offline | localStorage (fallback gdy brak konta) |

Kwoty w Supabase są przechowywane jako **centy (integer)**. UI pracuje na PLN (float) — przeliczenie przy zapisie/odczycie.

## Konfiguracja Supabase

1. Utwórz projekt na [supabase.com](https://supabase.com).
2. W `index.html` (stałe `SUPABASE_URL` / `SUPABASE_KEY` na początku skryptu Babel) ustaw swoje dane:
   ```js
   const SUPABASE_URL = 'https://TWOJ_PROJEKT.supabase.co';
   const SUPABASE_KEY = 'sb_publishable_...';  // anon/public key
   ```
3. Uruchom migracje **po kolei** w **SQL Editor** (Supabase Dashboard), pliki z `supabase/migrations/`:
   `000` … `009` (w tym **007** RLS profili/graczy, **008** Realtime, **009** funkcje `complete_friend_player_link` / `remove_friend_player_link` — bez **009** powiązania znajomych z klienta mogą kończyć się błędem RLS).
   Migracja **003** dodaje trigger: przy rejestracji od razu powstaje wiersz w `profiles` z emailem. Jeśli masz już własny trigger z panelu Supabase, uruchom skrypt świadomie (może nadpisać funkcję `handle_new_user`).
4. Realtime: migracja **008** dopisuje tabele do publikacji `supabase_realtime`; jeśli wdrażasz ręcznie starszą bazę, w Dashboard → **Database → Publications** upewnij się, że te tabele są w replikacji (jak w **008**).

## Lokalny development

Otwórz plik bezpośrednio w przeglądarce lub uruchom prosty serwer HTTP:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

Błędy JSX widać w konsoli przeglądarki (Babel transpiluje w runtime).

## Testy (opcjonalnie, Node.js)

```bash
npm test
```

Uruchamia `node --test` na [test/settlement.test.js](test/settlement.test.js) (funkcje z [lib/settlement.js](lib/settlement.js)).

## Deploy (Netlify)

W repozytorium jest **`netlify.toml`** z `publish = "."` — katalog główny (m.in. `index.html`) trafia na hosting **bez kroku build**.

**Checklist w Netlify (Dashboard → site → Build & deploy):**

1. **Continuous deployment** — repozytorium GitHub połączone, produkcja = gałąź **`main`**.
2. **Build settings** — *Build command* puste (Netlify czyta `netlify.toml`), *Publish directory* **`.`** lub puste (root).
3. Po zapisie ustawień każdy **`git push origin main`** powinien pokazać nowy deploy w zakładce **Deploys**.

### Netlify podpięte do GitHuba (zalecane)

Po **Import from Git** każdy push na **`main`** uruchamia deploy automatycznie (to jest domyślna ścieżka — nie trzeba GitHub Actions).

```bash
git add -A
git commit -m "Krótki opis zmian"
git push origin main
```

### Inaczej

```bash
# Przeciągnij katalog na netlify.com/drop
# lub przez CLI:
netlify deploy --prod --dir .
```

Nie ma kroku budowania — deploy to po prostu opublikowanie plików statycznych.

## Smoke test po wdrożeniu

1. Otwórz aplikację → ekran logowania powinien się pojawić.
2. Utwórz konto → zaloguj się.
3. Dodaj 2 graczy (zakładka **Gracze**).
4. Przejdź do **Sesji**, ustaw buy-in, dodaj graczy.
5. Przejdź do **Wyników**, wpisz cash-outy (suma = pula), kliknij **Oblicz**.
6. Zapisz sesję → sprawdź zakładkę **Historia**.
7. W Supabase Dashboard → Table Editor zweryfikuj wpisy w `sessions` i `transfers`.

## Struktura katalogów

```
index.html                        ← UI React + integracja Supabase
lib/settlement.js                 ← plnToCents, settleDebts, pluralPL (wspólne z testami)
test/settlement.test.js          ← testy Node
CLAUDE.md                         ← wskazówki dla Claude Code
supabase/
  migrations/
    000_profiles_players_participations.sql  ← tabele bazowe + RLS
    001_session_atomic.sql                   ← funkcje SECURITY DEFINER dla atomowego zapisu sesji
    002_live_session_state.sql               ← synchronizacja aktywnej sesji między urządzeniami
    003_profile_on_signup.sql                ← trigger: profil + email przy rejestracji (łączenie kont)
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
