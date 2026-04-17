# Poker Settler — Plan naprawczy i strukturalny

> Dokument roboczy. Zapisuje decyzje, diagnozę i plan prac, żeby każdy
> (człowiek lub AI) mógł później dołączyć i rozumieć *dlaczego* kod wygląda
> tak jak wygląda.

**Status:** Faza 2 — szkielet **Vite + TypeScript** wdrożony na `main` (build → `dist/`); dalszy podział `App.tsx` i warstwa `sync/` — do zrobienia.
**Branch roboczy:** `claude/fix-poker-sync-QSeli` (historyczny; praca na `main`).
**Data utworzenia:** 2026-04-17.

---

## 1. Kontekst i cel

Poker Settler to PWA po polsku do rozliczania długów po pokerze.
Obecnie app jest jednym plikiem `index.html` (2762 linie) z React + Babel
Standalone w przeglądarce, bez build-stepu, korzystającym z Supabase jako
backendu.

**Problem główny (zgłoszony przez właściciela):**
synchronizacja między urządzeniami jest zawodna — sesja zapisana na
telefonie A nie pojawia się na telefonie B nawet po odświeżeniu, konta/gracze
potrafią „znikać", zaproszenia gubią się w niebycie.

**Cel nadrzędny:** niezawodna, prosta i bezpieczna apka do rozliczania gier,
w której *dane się nie gubią* i oba telefony widzą to samo w rozsądnym
czasie.

---

## 2. Diagnoza (z czytania kodu + informacji od użytkownika)

### 2.1 Rozproszona logika sync
- Wywołań `supabase.from/channel/rpc/auth` jest ~46–50 i są rozrzucone po
  wszystkich komponentach React (Players, Session, Settlement, History,
  Profile, App).
- Każdy komponent ma własne, lekko różniące się wzorce „optymistyczny update
  + zapis do chmury". Nie ma jednej warstwy danych.
- Efekt: wyścigi (race conditions), część zapisów ląduje tylko w
  localStorage, brak spójnego traktowania offline/online.

### 2.2 Niejasne źródło prawdy
- Kod stosuje „last-write-wins po timestampie" w kilku miejscach, a w innych
  localStorage wygrywa z chmurą bez timestampu.
- Przy dwóch urządzeniach na tym samym koncie prowadzi to do „kasowania"
  świeżych danych stary snapshotem z drugiego urządzenia.

### 2.3 Migracje nie zawsze wgrane
- W folderze `supabase/migrations/` są **dwa pliki z prefiksem `005_`**:
  - `005_phone_and_friend_unique.sql`
  - `005_profiles_backfill_and_link_index.sql`
  Supabase CLI wykona je w kolejności alfabetycznej, ale zwykle powoduje to
  niejednoznaczność i pomijanie jednej z nich przy ręcznym stosowaniu.
- Migracje 004 i 008 włączają `publication supabase_realtime` dla tabel
  `live_session_state`, `players`, `sessions` itp. — jeśli któraś z nich
  nie została wykonana, realtime po prostu *nie działa* i sync milczy bez
  błędu.

### 2.4 Model danych: user ≠ player
- Dzisiaj `auth.users` ↔ `profiles` ↔ `players` to trzy oddzielne byty,
  łączone ręcznie przez `players.linked_user_id`.
- Właściciel zdecydował: **user = player**. Każdy zarejestrowany użytkownik
  jest automatycznie graczem. To upraszcza cały przepływ (logowanie,
  zaproszenia, statystyki) i eliminuje całą klasę bugów z „kontami w
  niebycie".

### 2.5 Offline handling
- Dziś: gdy zapis do chmury się nie uda, pojawia się retry queue w LS, ale
  jego wykonanie zależy od tego, czy user w ogóle wróci do karty.
- Nie ma prawdziwej kolejki wysyłki i flush-on-online.

### 2.6 Brak telemetrii
- Gdy coś pada, nikt się o tym nie dowiaduje. Nie ma logów poza konsolą
  przeglądarki (której user nie otwiera).

---

## 3. Decyzje architektoniczne

Podjęte wspólnie z właścicielem (po 26 pytaniach):

| Obszar | Decyzja |
|---|---|
| **Źródło prawdy** | Supabase (chmura). localStorage tylko jako cache offline + kolejka wysyłki. |
| **Offline** | Automatyczny flush kolejki przy powrocie sieci. Bez interakcji użytkownika. |
| **User = Player** | Jeden byt. Rejestracja tworzy profil + rekord gracza. Połączenie po e-mailu (główne) lub telefonie (opcjonalne). |
| **Auth** | E-mail + hasło, z potwierdzeniem e-mail. Sesja długa (30 dni, auto-refresh). Bez passwordless na razie. |
| **Zaproszenia** | Po e-mailu LUB telefonie. Odbiór w apce. |
| **Sumy sesji** | Zero-sum, walidacja przy zapisie. |
| **Edycja historii** | Tylko host. Host może usunąć sesję. |
| **Stack docelowy** | Vite + TypeScript + React, bez SSR. Deploy: Netlify (jak dzisiaj). |
| **Struktura plików** | Podział na moduły (`auth/`, `db/`, `sync/`, `features/*`). Koniec jednego pliku. |
| **Telemetria** | Tabela `client_logs` w Supabase. Anonimowe, ale z `user_id` jeśli user jest zalogowany. |
| **Uruchamianie** | `npm run dev` lokalnie. Koniec z dwuklikiem w `index.html`. |

---

## 4. Plan prac w 3 fazach

### Faza 0 — Diagnostyka Supabase (1 dzień, głównie po stronie właściciela)
Cel: potwierdzić stan produkcyjnego Supabase zanim tkniemy kod.

Kroki:
1. Właściciel wykonuje `docs/SUPABASE_CHECKLIST.md` (osobny plik, krok po
   kroku ze screenami).
2. Jeśli brakuje migracji — wgrywam je ręcznie przez SQL editor Supabase
   (lub CLI, jeśli mam dostęp).
3. Weryfikacja, że Realtime publication ma wszystkie tabele.
4. Ewentualny jednorazowy skrypt czyszczący orfany w `players`
   (niepowiązane `session_players`, wiszące `friend_invites`).

**Warunek wejścia w Fazę 1:** potwierdzenie, że schema prod = repo +
Realtime działa.

### Faza 1 — Hotfix sync w obecnej architekturze (1–2 dni)
Cel: zatrzymać krwawienie przed dużym refaktorem, żeby user mógł grać.

1. **Jedna funkcja `saveSession()`** — wszystkie zapisy sesji przechodzą
   przez nią. Najpierw do chmury, dopiero potem do LS. Jeśli chmura padnie
   → kolejka + widoczny komunikat.
2. **Force refresh po wznowieniu z tła** — przy `visibilitychange` porównuj
   `updated_at` z serwera z tym co w LS; jeśli serwer nowszy → nadpisz LS.
3. **Kolejka offline (`poker_pending_writes`)** — prosta lista operacji,
   flushowana przy `online` i przy każdym otwarciu apki.
4. **Tabela `client_logs`** + loger który łapie wszystkie błędy Supabase.
   Dzięki temu *zobaczymy* kiedy sync pada, zamiast zgadywać.
5. **Migracja `014_user_is_player.sql`** — automatyczne utworzenie
   rekordu `players` przy rejestracji usera (rozszerzenie triggera z 003).

### Faza 2 — Refaktor strukturalny: Vite + TypeScript (3–5 dni)
Cel: raz na zawsze skończyć z pojedynczym plikiem 2762 linii.

Proponowana struktura:
```
src/
├── main.tsx                  — entry
├── App.tsx                   — router + providers
├── lib/
│   ├── supabase.ts           — init klienta (jedyne miejsce)
│   ├── db.types.ts           — typy z supabase gen types
│   └── settlement.ts         — istniejące + testy
├── sync/
│   ├── queue.ts              — offline queue
│   ├── realtime.ts           — zarządzanie kanałami
│   ├── useCloudState.ts      — hook do synced state
│   └── resume.ts             — obsługa visibilitychange / online
├── auth/
│   ├── useAuth.ts
│   └── AuthScreen.tsx
├── features/
│   ├── players/              — PlayersTab + useCases
│   ├── session/              — SessionTab
│   ├── settlement/           — SettlementTab
│   ├── history/              — HistoryTab
│   └── profile/              — ProfileView
└── ui/                       — współdzielone komponenty, ikony
```

**Zasady:**
- Jeden wspólny klient Supabase. Zero `supabase.from` poza `src/lib` i
  `src/sync`.
- Każda feature-folder eksportuje tylko komponent + hooki — nigdy nie sięga
  do Supabase bezpośrednio.
- Wszystkie typy generowane z `supabase gen types typescript` — koniec z
  literówkami w nazwach kolumn.

### Faza 3 — Higiena, testy, dopieszczenie (1–2 dni)
1. Testy jednostkowe dla `sync/queue.ts` (deterministyczne).
2. Testy e2e dla krytycznej ścieżki: rejestracja → sesja → wypłata →
   historia widoczna na drugim urządzeniu (symulowanym).
3. Skrypt naprawczy: odnalezienie „kont w niebycie" i albo ich usunięcie,
   albo scalenie z właściwymi.
4. Audyt RLS: każda tabela ma jasno opisane polityki
   `select`/`insert`/`update`/`delete`.
5. README v2 z instrukcją dla nowego developera (albo AI).

---

## 5. Ryzyka i decyzje otwarte

- **Migracja user=player** wymaga backfillu istniejących danych. Przed jej
  puszczeniem zrobimy snapshot bazy (Supabase → Database → Backups).
- **Przełączenie na Vite** oznacza że użytkownicy muszą raz wymusić
  odświeżenie (Ctrl+Shift+R) po deployu, bo zmieni się hash pliku. Nic
  drastycznego.
- **Telemetria** zbiera też adresy IP domyślnie — zostawimy tylko `user_id`
  + kod błędu + timestamp, żeby nie wpadać w RODO niepotrzebnie.

---

## 6. Co robimy teraz (kolejne kroki)

1. ⏳ Właściciel czyta ten plan i akceptuje / koryguje.
2. ⏳ Właściciel wypełnia `docs/SUPABASE_CHECKLIST.md` i wysyła wyniki.
3. ⏳ Faza 1 (hotfix) — start po akceptacji.

---

## 7. Historia zmian tego dokumentu

- **2026-04-17** — wersja 1, plan stworzony po diagnostyce i 26 pytaniach
  do właściciela.
