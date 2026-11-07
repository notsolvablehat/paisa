# paisa

Personal finance dashboard: "safe to spend today", spending, income, budgets, goals and bills.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · Tailwind v4 · uiarc components (`src/components/arc`, via the shadcn CLI) · TanStack Query · Zustand · Drizzle ORM · PostgreSQL · better-auth · zod · Vitest

## Run it

```bash
npm run dev            # http://localhost:3000
npm run db:seed        # (dev server running) demo@paisa.local / paisa-demo-123
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests for money, dates and every dashboard formula |
| `npm run typecheck` / `lint` | TypeScript / ESLint |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Browse the database |
| `npm run db:seed [-- email]` | Reset an account to the design's demo data |
| `npm run db:seed:history -- email` | Replace an account's data with ~5 months of synthetic history |
| `NEW_PASSWORD='…' npm run db:set-password -- email` | Set an account's password (signs it out everywhere) |
| `npm run data:export -- email` | Write one account (login + all its data) to `data/<email>.json` |
| `TARGET_DATABASE_URL=… npm run data:import -- data/<email>.json [--replace]` | Load that file into another database, in one transaction |

Any script reads `DATABASE_URL` from `.env.local` unless you set it in the shell (`DATABASE_URL=… npm run db:migrate` targets another database). `data/` holds a password hash and personal data and is gitignored.

## Deploy (Vercel + Neon)

1. **Neon:** create a project in the region nearest you. Copy two connection strings: the **pooled** one (host contains `-pooler`) for the app, and the **direct** one for migrations.
2. **Schema:** `DATABASE_URL='<neon direct url>' npm run db:migrate`
3. **Your data (optional):** `npm run data:export -- you@example.com`, then `TARGET_DATABASE_URL='<neon direct url>' npm run data:import -- data/you@example.com.json`
4. **Vercel:** import the repo (framework: Next.js, root: `code/` if the repo root is above it). Set env vars:
   - `DATABASE_URL`: Neon **pooled** URL (keeps `?sslmode=require`)
   - `BETTER_AUTH_SECRET`: a new one, `openssl rand -base64 32` (don't reuse the local secret)
   - `BETTER_AUTH_URL`: `https://<your-domain>` (sign-in breaks if this doesn't match the URL you open)
   - `DISABLE_SIGNUP`: `true` once your accounts exist (optional)
5. In Vercel → Settings → Functions, set the region to match Neon's, so every query isn't a round trip across the world.
6. Later schema changes: `npm run db:generate` locally, commit, then run step 2 against Neon before (or right after) deploying.

## How it's put together

```
src/db/schema.ts        tables + constraints (money = bigint paise)
src/server/queries.ts   reads (always scoped by session user id)
src/server/actions.ts   writes: server actions, zod-validated, auth-checked
src/lib/finance.ts      pure formulas (safe-to-spend, charts, bills…) — tested
src/app/api/dashboard   GET endpoint TanStack Query reads from (one month)
src/app/api/ledger      GET spends + income for a date range (/transactions)
src/app/api/reminders   GET reminders for a date range, plus anything overdue (/reminders)
src/components/dashboard/*  overview sections, app shell (header, quick add)
src/components/transactions, reminders  the two list pages (filters, table, totals)
src/components/arc/*        uiarc components (owned copies — see notes below)
src/app/(auth)/*            /sign-in and /sign-up
src/stores/ui.ts        Zustand: viewed month, chart range, modal state
```

## Data correctness

- **Money is integer paise** (`bigint`), never floats. Amounts move between browser, server and DB as paise (uiarc MoneyInput works in minor units); typed text is parsed without float maths (`src/lib/money.ts`).
- **Dates are calendar dates** (`date`, `YYYY-MM-DD`) evaluated in `APP_TZ` (default `Asia/Kolkata`) so "today" never drifts with server timezone.
- **Database constraints** back up validation: positive amounts, name lengths, colour/icon formats, unique category names per user (case-insensitive), a bill can only be paid once, recurring bills can't duplicate an occurrence.
- **Goal contributions** lock the goal row so concurrent assigns can't overshoot the target.
- **Balance** = adjustment + Σ income − Σ spends up to today; "click to correct" stores only the adjustment, so history stays intact.

## Pages

- `/` Overview — safe-to-spend, spending, recent spends, what's due, income, goals, budgets. Month picker in the title row.
- `/transactions` — every spend and income in a date range: search, filter chips (type, category, source, amount), sortable table, totals and a spend-by-category donut.
- `/reminders` — every bill occurrence in a range (overdue always included): tick paid, edit, stop; fixed costs per month.

Reminders are paid in order: a recurring bill can't be ticked while an earlier one is unpaid, and unticking removes the next occurrence that ticking created.

## Security

- Every read/write re-checks the session on the server (`requireUserId`); user id never comes from the client.
- **Composite foreign keys** `(id, user_id)` make it impossible at the DB level to attach a spend/bill/contribution to another user's category or goal.
- Server actions get Next's built-in Origin check (CSRF); auth endpoints are rate-limited; passwords ≥ 10 chars (scrypt-hashed by better-auth).
- Errors returned to the browser are generic; details only go to server logs.
- Security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS in prod) in `next.config.ts`.
- `.env.local` holds the DB password and auth secret; it's gitignored. The app DB role is a non-superuser that owns only the `paisa` database.
- Set `DISABLE_SIGNUP=true` once your account exists to close registration.

## uiarc notes

- Add more components with `npx shadcn@latest add @uiarc/<name>` (registry is in `components.json`).
- Theme: `foundation.css` is loaded first; `globals.css` re-points uiarc tokens (`--accent`, `--surface`, …) at the paisa palette (`--p-*`, Graphite + Coral). Dark mode = `data-theme="dark"` on `<html>`.
- Local fixes to the copied files (re-apply if you re-install them): `dialog`, `tabs` and `tooltip` used a `render` prop / bare trigger that current Radix doesn't support → switched to `asChild`. `morph-select` rows are capped to the panel width.
- `next.config.ts` keeps the Tailwind loader off `*.module.css` (uiarc's CSS modules use `:global()` selectors it can't parse).
