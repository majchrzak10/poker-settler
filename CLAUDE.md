# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Handoff / kontekst decyzyjny (diagnoza sync, migracje, pułapki):** zacznij od [`docs/CONTEXT.md`](docs/CONTEXT.md).

## Overview

**Poker Settler** — Polish-language PWA for settling poker debts among friends. UI is **Vite + React + TypeScript** (`src/`, entry `src/main.tsx`). Shared settlement helpers live in **`src/lib/settlement.ts`** (covered by **`npm test`** / Vitest).

## Architecture

```
index.html              ← Vite HTML shell (root)
src/
├── main.tsx            ← createRoot, PWA, initClientTelemetry, StrictMode
├── App.tsx             ← stan globalny, routing zakładek; sync przez hooki w `sync/`
├── config.ts           ← Supabase URL + anon key
├── index.css / pwa.ts
├── app/                ← keys.ts, navigation.tsx (TABS / SCREEN_META)
├── auth/useAuth.tsx
├── features/
│   ├── auth/AuthScreens.tsx
│   ├── players/PlayersTab.tsx
│   ├── session/SessionTab.tsx
│   ├── settlement/SettlementTab.tsx
│   ├── history/HistoryTab.tsx + historyUtils.tsx
│   └── profile/ProfileView.tsx
├── lib/                ← supabase.ts, settlement.ts, storage, format, historyShared
├── sync/               ← `useCloudSync` (refresh + Realtime + merge live draft), `useLiveSessionPush` (debounced `live_session_state`), `persistSession` (RPC / fallback zapisu sesji), `sessionRpc`, `errors`, `telemetry`
└── ui/icons.tsx        ← ikony SVG
```

- **Build:** `npm run build` → `dist/` (Netlify publish directory).
- **Dev:** `npm run dev` (Vite HMR).
- **Styling:** Tailwind via PostCSS (`tailwind.config.js`).
- **Backend:** Supabase (`@supabase/supabase-js`); jeden klient w `src/lib/supabase.ts` (`export const supabase`).

## State & Storage

State is managed in `App` and passed down as props. Dual persistence:

- **localStorage** — instant offline access (`poker_players`, `poker_session`, etc.)
- **Supabase** — cloud sync when logged in

Monetary values in Supabase: **integer cents**. UI: PLN floats; convert at the boundary (`plnToCents`).

## Supabase Schema

See `docs/CONTEXT.md` for tables and migration overview.

## Key Algorithms

- **`settleDebts(entries)`** — greedy debt minimisation (`src/lib/settlement.ts`)
- **`pluralPL(n, one, few, many)`** — Polish plural forms

## Running / Editing

```bash
npm install          # pierwszy raz
npm run dev          # http://localhost:5173
npm run build        # dist/
npm test             # Vitest — settlement
```

**Typy Supabase (`Database`):** `src/types/database.types.ts` jest importowany w `src/lib/supabase.ts` jako `createClient<Database>(...)`. Domyślnie `Database` to placeholder (`any`), żeby nie psuć inferencji przed pierwszym generowaniem. Pełny schemat:

```bash
supabase login && supabase link   # powiązanie z projektem
npm run gen:types                 # nadpisuje src/types/database.types.ts
# alternatywnie (token w CI): npm run gen:types:project + SUPABASE_ACCESS_TOKEN
```

`App.tsx` is still marked `// @ts-nocheck` until types are tightened incrementally.

## Adding Features

Prefer new files under `src/features/<name>/` and import into `App.tsx` rather than growing the monolith further.
