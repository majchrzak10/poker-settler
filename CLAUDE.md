# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Poker Settler** — single-page Polish-language PWA for settling poker debts among friends. Main UI is `index.html`; shared settlement helpers live in `lib/settlement.js` (also covered by `npm test`).

## Architecture

Single `index.html` file with no build step. React, Babel, Tailwind, and Supabase are all loaded via CDN. JSX is transpiled in the browser by Babel Standalone. `lib/settlement.js` exposes `plnToCents`, `settleDebts`, and `pluralPL` on `window.PokerSettlerCore` before the Babel bundle runs.

```
index.html
├── <head>      — CDN imports, PWA manifest + icons (single base64, injected by script), Tailwind config
├── lib/settlement.js — plnToCents, settleDebts, pluralPL
└── <script type="text/babel">
    ├── Supabase client init (SUPABASE_URL, SUPABASE_KEY)
    ├── Utils: generateId, loadLS, getTotalBuyIn, formatDate, formatPhone (settlement utils from PokerSettlerCore)
    ├── Icons — inline SVG components
    ├── useAuth — Supabase auth hook
    ├── AuthScreen — login / registration
    ├── PlayersTab — player CRUD, session add, account linking
    ├── SessionTab — current session: buy-ins per player, total pot
    ├── SettlementTab — cash-out entry, balance check, debt calculation, save
    ├── HistoryTab — archive + leaderboard (rankings by period)
    ├── ProfileView — user profile, per-user stats, localStorage→cloud migration
    └── App — root: all state lives here, syncs to localStorage + Supabase
```

## State & Storage

State is managed in `App` and passed down as props. All state is dual-persisted:

- **localStorage** — instant offline access (`poker_players`, `poker_session`, `poker_default_buyin`, `poker_sessions_history`)
- **Supabase** — cloud sync when user is logged in (loaded on auth, written on every mutation)

Monetary values in Supabase are stored as **integer cents** (×100). The UI works in PLN floats; convert at the boundary.

## Supabase Schema

Tables: `profiles`, `players`, `sessions`, `session_players`, `transfers`, `participations`

- `players.linked_user_id` — links a player record to a registered user account (for cross-account stats)
- `participations` — denormalised view of a user's own game history, populated when a linked player is in a finished session

## Key Algorithms

- **`settleDebts(entries)`** — greedy debt minimisation: sorts creditors/debtors descending, matches largest pairs first, minimises transfer count
- **`pluralPL(n, one, few, many)`** — correct Polish plural forms (1 gra / 2–4 gry / 5+ gier)

## Running / Editing

Open `index.html` directly in a browser — no server or build step needed. For live editing, any local HTTP server works (e.g. `python3 -m http.server`).

Because Babel transpiles JSX at runtime, errors appear in the browser console with the original JSX source. There is no TypeScript or project linter. Settlement helpers in `lib/settlement.js` are covered by `npm test` (`test/settlement.test.js`).

## Adding Features

All component code is in one `<script type="text/babel">` block. To add a new tab, add an entry to the `TABS` array and a corresponding component. To add a new Supabase operation, call `supabase.from(...)` inline — the pattern throughout the file is: optimistic local state update first, then async Supabase write.
