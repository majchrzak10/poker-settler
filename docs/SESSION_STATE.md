# SESSION_STATE.md — Stan sesji roboczej (2026-05-01)

> Ten plik opisuje dokładnie co zostało zrobione, co jest w toku i co jeszcze trzeba zrobić ręcznie.
> Stworzony po to, żeby nowa sesja Claude Code mogła kontynuować bez utraty kontekstu.

---

## Repo i gałąź

- **Repo:** `majchrzak10/poker-settler`
- **Aktywna gałąź:** `claude/fix-poker-sync-QSeli`
- **Deploy:** Netlify z `main`; po skończeniu tej gałęzi trzeba zrobić PR i merge do `main`.
- **Supabase project ref:** `oatfqrijmwdnkztgvzwx`

---

## Co zostało zrobione (kod — wszystko skomitowane i spushowane)

### Commit `aa4ffd9` — fix(reliability)
- **Migracja 022** (`supabase/migrations/022_reliability_fixes.sql`) — trigger `session_players_auto_participation` zmieniony na `AFTER INSERT OR UPDATE` (wcześniej tylko `INSERT`, przez co edycja cash_out nie trafiała do `participations`).
- **Scoped localStorage** (`src/lib/storage.ts`) — klucze `poker_*` mają teraz prefix `poker_<userId>_*` gdy użytkownik jest zalogowany. Przy wylogowaniu czyścimy klucze poprzedniego usera.
- **Token refresh reconnect** (`src/sync/useCloudSync.ts` + `src/auth/useAuth.tsx`) — przy zdarzeniu `TOKEN_REFRESHED` od Supabase, kanał Realtime jest reconnectowany (via `setSyncChannelNonce`).
- **Swallowed error fix** (`src/App.tsx`) — `catch (_) {}` przy fresh players fetch zamienione na `console.warn` + `logClientEvent`.
- **Filtr friend_invites realtime** (`src/sync/useCloudSync.ts`) — dwie osobne subskrypcje z filtrami `requester_user_id=eq.${user.id}` i `invitee_user_id=eq.${user.id}`.
- **Dedup sourceSessionId** (`src/lib/historyShared.ts`) — `mapSharedParticipations` zawsze ustawia `sourceSessionId`, fix dedup w `combinedHistory`.

### Commit `b393cee` — feat: 4 nowe featury
- **Badge'e (zielona kropka)** na zakładkach Historia i Profil:
  - `src/sync/useUnreadBadges.ts` — nowy hook: `hasNewShared`, `hasNewInvites`, `markSharedSeen`, `markInvitesSeen`.
  - Klucze w localStorage: `poker_<userId>_seen_shared`, `poker_<userId>_seen_invites`.
  - `src/App.tsx` — wywołanie mark seen przy kliknięciu zakładki; render zielonej kropki obok History i Profile.
- **Eksport CSV** (`src/lib/csvExport.ts`, `src/lib/csvExport.test.ts`):
  - Funkcja `exportHistoryToCsv(history)` → RFC 4180 CSV.
  - Przycisk "Eksportuj CSV" w `src/features/history/HistoryTab.tsx`.
- **Filtr rankingu per-znajomy** (`src/features/history/HistoryTab.tsx`):
  - Dropdown "Pokaż tylko sesje z:" + lista graczy.
  - Stan `rankFilter` filtruje `combinedHistory` → `calculateAllTimeStats`.
- **Edycja sesji przez gościa z akceptacją hosta:**
  - Migracja 023 (`supabase/migrations/023_session_edit_proposals.sql`) — tabela `session_edit_proposals` + RPC `propose_session_edit` + `respond_session_edit`.
  - `src/features/history/PendingEditsPanel.tsx` — nowy komponent dla hosta (lista oczekujących propozycji, diff, przyciski akceptuj/odrzuć).
  - `src/features/history/HistoryTab.tsx` — przycisk "Zaproponuj zmianę" w shared-session card.
  - `src/sync/useCloudSync.ts` — nowa subskrypcja Realtime dla `session_edit_proposals`.

---

## Co jeszcze trzeba zrobić RĘCZNIE (nie da się z Claude)

### KRYTYCZNE: Uruchom migracje w Supabase SQL Editor

URL: `https://supabase.com/dashboard/project/oatfqrijmwdnkztgvzwx/sql`

**Migracja 022** — wklej i uruchom:
```sql
DROP TRIGGER IF EXISTS session_players_auto_participation ON public.session_players;
CREATE TRIGGER session_players_auto_participation
  AFTER INSERT OR UPDATE ON public.session_players
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_participation();
```

**Migracja 023** — skopiuj cały plik `supabase/migrations/023_session_edit_proposals.sql` i uruchom.
Plik tworzy: tabelę `session_edit_proposals`, polityki RLS, `ALTER PUBLICATION supabase_realtime`, RPC `propose_session_edit`, RPC `respond_session_edit`.

---

### Email — Resend SMTP (żeby rejestracja działała bez limitów)

**Problem:** Domyślny Supabase SMTP ma limit ~3 maile/godz. Użytkownik przekroczył limit.

**Rozwiązanie:** Konfiguracja własnego SMTP przez Resend.

#### Krok 1: DNS dla domeny `bioredlab.pl` (w Cyber-Folks / DirectAdmin)

Dodaj rekordy w panelu DNS (DirectAdmin → "DNS Management"):

| Typ | Name (subdomena) | Wartość |
|-----|-----------------|---------|
| CNAME | `resend._domainkey` | (z panelu Resend — patrz niżej) |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com.` (z kropką na końcu!), Priority: 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |

**Jak sprawdzić DKIM wartość:** zaloguj się na `resend.com` → Domains → `bioredlab.pl` → tam są dokładne wartości do skopiowania.

Status: DKIM był już zweryfikowany ✓. MX i SPF mogły jeszcze nie przejść weryfikacji (DNS propaguje do 48h).

#### Krok 2: Supabase SMTP Settings

URL: `https://supabase.com/dashboard/project/oatfqrijmwdnkztgvzwx/settings/auth`
Sekcja: "SMTP Settings" → włącz "Enable Custom SMTP"

Wartości:
- **Host:** `smtp.resend.com`
- **Port:** `465`
- **Username:** `resend`
- **Password:** `re_B21Ltjv8_DbtVfAapg3YyvhaJPJpM852d`
- **Sender name:** `Poker Settler`
- **Sender email:** `noreply@bioredlab.pl`

#### Krok 3: Test

Po zapisaniu SMTP — zrób rejestrację testową nowym mailem i sprawdź czy przychodzi.

---

### Po skończeniu: Merge do main

Gałąź `claude/fix-poker-sync-QSeli` jest gotowa. Utwórz PR i zmerge do `main`, żeby Netlify zbudował i wdrożył nową wersję.

---

## Znane problemy / ograniczenia techniczne

- **Claude Code nie może łączyć się z Supabase** z powodu sandboxu (zablokowane `*.supabase.com`, `*.supabase.co`). Dlatego migracje i konfiguracja SMTP muszą być zrobione ręcznie.
- **Błąd `API Error 400: messages text content blocks must be non-empty`** — pojawia się gdy wysyłasz obrazek w bardzo długiej sesji Claude Code. Rozwiązanie: zacznij nową sesję.
- **MCP Supabase** skonfigurowany w `.mcp.json` — ładuje się tylko przy starcie sesji. Wymaga `SUPABASE_ACCESS_TOKEN` w env. Token zapisany w `~/.bashrc` i `~/.profile`.

---

## Pliki kluczowe

| Plik | Co robi |
|------|---------|
| `src/App.tsx` | Główny stan, routing zakładek, wywołania hooków |
| `src/sync/useCloudSync.ts` | Realtime + refresh danych z Supabase |
| `src/sync/useUnreadBadges.ts` | Hook badge'y Historia/Profil |
| `src/sync/persistSession.ts` | Zapis/update sesji przez RPC |
| `src/lib/storage.ts` | localStorage scoped per-user |
| `src/lib/csvExport.ts` | Eksport historii do CSV |
| `src/lib/historyShared.ts` | Shared participations (historia od znajomych) |
| `src/auth/useAuth.tsx` | Auth, token refresh callback |
| `src/features/history/HistoryTab.tsx` | Historia + filtr rankingu + CSV + propose-edit |
| `src/features/history/PendingEditsPanel.tsx` | Panel hosta: propozycje edycji od gości |
| `supabase/migrations/022_reliability_fixes.sql` | Trigger INSERT OR UPDATE (DO URUCHOMIENIA) |
| `supabase/migrations/023_session_edit_proposals.sql` | Tabela + RPC edycji gościa (DO URUCHOMIENIA) |

---

## Jak wznowić pracę w nowej sesji

1. Otwórz nową sesję Claude Code w katalogu `/home/user/poker-settler`.
2. Powiedz: *"Przeczytaj docs/SESSION_STATE.md i docs/CONTEXT.md i kontynuuj od miejsca gdzie skończyliśmy."*
3. Nowa sesja będzie miała pełny kontekst.
