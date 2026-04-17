# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Handoff / kontekst decyzyjny (diagnoza sync, migracje, pułapki):** zacznij od [`docs/CONTEXT.md`](docs/CONTEXT.md).

## Overview

**Poker Settler** — Polish-language PWA for settling poker debts among friends. UI is **Vite + React + TypeScript** (`src/`, entry `src/main.tsx`). Shared settlement helpers live in **`src/lib/settlement.ts`** (covered by **`npm test`** / Vitest).

## Architecture

```
index.html              ← Vite HTML shell (root)
src/
├── main.tsx            ← createRoot, PWA head inject, StrictMode
├── App.tsx             ← cała aplikacja (duży plik; docelowo podział na features/)
├── config.ts           ← Supabase URL + anon key (import.meta.env.VITE_*)
├── index.css           ← Tailwind + global styles
├── pwa.ts              ← manifest + icons (inline SVG base64)
└── lib/
    └── settlement.ts   ← plnToCents, settleDebts, pluralPL, formatPln
```

- **Build:** `npm run build` → `dist/` (Netlify publish directory).
- **Dev:** `npm run dev` (Vite HMR).
- **Styling:** Tailwind via PostCSS (`tailwind.config.js`).
- **Backend:** Supabase (`@supabase/supabase-js`); client created once in `App.tsx` (re-export `supabase`).

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

`App.tsx` is still marked `// @ts-nocheck` until types are tightened incrementally.

## Adding Features

Prefer new files under `src/features/<name>/` and import into `App.tsx` rather than growing the monolith further.
