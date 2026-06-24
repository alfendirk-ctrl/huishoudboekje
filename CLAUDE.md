# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Huishoudboekje** ("Household Ledger") is a Dutch-language personal finance web app for shared household budgeting. Built with React + Vite, deployed to GitHub Pages, backed by Supabase with localStorage fallback.

## Commands

```bash
npm run dev       # Start dev server at http://localhost:5173/huishoudboekje/
npm run build     # Production build
npm run preview   # Preview production build locally
```

No linting or test infrastructure is configured.

## Architecture

The app is nearly entirely contained in two source files:

- **`src/db.js`** — Supabase client setup + `dbLoad(key)` / `dbSave(key, value)` helpers. Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON` env vars. Falls back to `localStorage` when Supabase is unavailable.
- **`src/App.jsx`** — Single monolithic component (~1000+ lines) containing all state, logic, and UI including ~500 lines of embedded CSS.

### Data Model

All persistent state is JSON-serialized via `dbSave`/`dbLoad`:

```
data.inkomen          — Dirk & Shelley net salaries
data.groups           — Expense categories (4 default groups)
data.months[YYYY-MM]  — Monthly ledger: budget posts + actuals per expense
data.spaar[YYYY-MM]   — Savings/investment pot allocations
memory                — Learned transaction description → post mappings (separate key)
```

### Tab Structure

| Tab | Dutch name | Purpose |
|-----|-----------|---------|
| 1 | Maandplan | Budget entry: income and expense categories |
| 2 | Sparen | Savings allocation and budget availability |
| 3 | Resultaat | Income breakdown, savings tracking, monthly chart |
| 4 | Maandcheck | CSV import, transaction triage, expense verification |

### Key Functions in App.jsx

- `parseRabobank()` — Parses Rabobank-format CSV bank statements
- `classifyTx()` — Categorizes transactions by bank code (type/counterparty)
- `kwMatch()` — Keyword-based fallback categorization
- `memKey()` — Normalizes transaction descriptions for the learned-memory system
- `aiCategorize()` — Offline placeholder for AI-assisted categorization

### Data Flow

State changes → `useEffect` debounce (800ms) → `dbSave()` → Supabase or localStorage. Every 30 seconds a `dbLoad()` pull syncs latest data. Computed values (group totals, savings availability) derive via `useMemo`.

## Environment

Requires a `.env` file (not committed):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON=...
```

Supabase table schema:
```sql
CREATE TABLE storage (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Deployment

GitHub Pages at `https://alfendirk-ctrl.github.io/huishoudboekje/`. Vite base path is `/huishoudboekje/`. GitHub Actions auto-deploys on push to `main` using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON` repository secrets.
