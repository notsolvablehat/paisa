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

## How it's put together

```
src/db/schema.ts        tables + constraints (money = bigint paise)
src/server/queries.ts   reads (always scoped by session user id)
src/server/actions.ts   writes: server actions, zod-validated, auth-checked
src/lib/finance.ts      pure formulas (safe-to-spend, charts, bills…) — tested
src/app/api/dashboard   GET endpoint TanStack Query reads from
src/components/dashboard/*  UI sections matching the design
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
- Local fixes to the copied files (re-apply if you re-install them): `dialog`, `tabs` and `tooltip` used a `render` prop / bare trigger that current Radix doesn't support → switched to `asChild`.
- `next.config.ts` keeps the Tailwind loader off `*.module.css` (uiarc's CSS modules use `:global()` selectors it can't parse).
