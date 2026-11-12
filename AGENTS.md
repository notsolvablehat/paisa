<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# paisa — agent guide

Personal finance dashboard ("safe to spend today", spends, income, reminders/bills, goals, budgets). Single-user-per-account, India-first (₹, en-IN, `Asia/Kolkata`). `README.md` has the human-facing overview; this file is what an agent needs to work safely.

## Working with the owner

- **Package installs:** don't install packages yourself. Put every install (npm or `npx shadcn add @uiarc/...`) in **one script** the user runs (see `../setup.sh`, `../setup-uiarc.sh`, `../setup-uiarc-2.sh`), then wait for them to confirm.
- **Commits:** only when asked. Repo is `code/` (branch `main`); `.env.local` must never be committed.
- **Ask** when a design choice is genuinely theirs; otherwise pick a sensible default and say so.
- Design source of truth: `../Finance Dashboard.dc.html` (auth mockups 1b/1c inside it). Look = **uiarc everywhere**, palette **Graphite + Coral** (no yellow/purple).

## Stack

Next.js 16.4 (App Router, Turbopack, `cacheComponents`, `proxy.ts` instead of middleware) · React 19 · Tailwind v4 · uiarc components (shadcn registry `@uiarc`, copied into `src/components/arc`) · TanStack Query · Zustand · Drizzle ORM + `pg` · PostgreSQL 18 (local) · better-auth (email + password) · zod v4 · Vitest · Remix Icon (`ri-*` classes) · Inter + Geist fonts.

## Commands

```bash
npm run dev                 # localhost:3000 (check nothing is already on 3000)
npm run typecheck && npm run lint && npm test   # run all three before handing back
npm run db:generate         # after editing src/db/schema.ts → then db:migrate
npm run db:migrate
npm run db:seed             # demo@paisa.local / paisa-demo-123 (needs dev server for sign-up)
npm run db:seed:history -- <email>   # REPLACES that account's spends/income/bills/goals with ~5 months of synthetic data
```

- **Never run `next build` while a dev server is running.** Both write `.next/` and `next-env.d.ts`; the dev server then rebuilds and full-reloads the page in a loop. Stop dev first (or skip the build).
- DB: role `paisa_app`, database `paisa`; `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` in `.env.local` (chmod 600). `psql "$DATABASE_URL"` for ad-hoc checks.
- Accounts: `notsolvablehat@gmail.com` (owner, seeded with history; don't wipe without asking) and `demo@paisa.local` (safe to reseed for testing).

## Layout

```
src/app/page.tsx         public landing page (static, SEO copy + JSON-LD; components/landing/)
src/app/(app)/layout.tsx   signed-in pages share it: <Suspense> + getSessionUser() → AppFrame (header, dialogs, dashboard data) mounted once
src/app/(app)/overview/, transactions/, reminders/   thin pages → client page component (noindex); loading.tsx = content-area spinner
src/app/robots.ts, sitemap.ts, llms.txt/, opengraph-image.tsx, manifest.ts   SEO / sharing; facts in src/lib/site.ts
src/app/(auth)/sign-in, sign-up               auth-shell.tsx (decor) + auth-forms.tsx
src/app/api/dashboard   GET ?month=YYYY-MM → DashboardData (one month + history)
src/app/api/ledger      GET ?from&to → spends + income (Transactions page)
src/app/api/reminders   GET ?from&to → bill occurrences in range + all unpaid overdue
src/app/api/auth/[...all]  better-auth handler
src/proxy.ts            optimistic cookie check: `/` → /overview when signed in; app routes → /sign-in when not. Matcher lists every signed-in route — add new pages here (and to PRIVATE in robots.ts)
                        dashboard URL is `APP_HOME` (/overview) from src/lib/site.ts; never hard-code `/` for it
src/db/schema.ts        tables + constraints;  drizzle/ migrations
src/server/queries.ts   reads (always filtered by user id)
src/server/actions.ts   "use server" writes via action(schema, fn) wrapper
src/server/session.ts   requireUserId(), getSessionUser()
src/lib/finance.ts      pure formulas (safe-to-spend, charts, bills, goals) + finance.test.ts
src/lib/money.ts, dates.ts, constants.ts, types.ts
src/hooks/use-dashboard.ts   useDashboard, useLedger, useReminders, useAction, useToast
src/hooks/use-delete-spend.ts  delete with Undo toast
src/stores/ui.ts        Zustand: viewed month, chart range, quick-add modal, goal dialog
src/components/dashboard/   app-shell (header, Ctrl/⌘K, FAB, QuickAdd, GoalDialog), overview sections, primitives
src/components/transactions/, reminders/   list pages (+ reminder-dialog)
src/components/arc/         uiarc copies (owned code — see local fixes)
scripts/seed-demo.ts, seed-history.ts
```

## Rules that keep data right

- **Money is integer paise** everywhere (DB `bigint`, API, actions, MoneyInput values). Charts take rupees (`paise / 100`) only at the render edge. Parse typed text with `parseToPaise` (no float maths). Format with `formatINR` (decimals only when there are paise), `formatRoundINR` (stats), `formatCompactINR` (₹95.7K / ₹1.1L for chart centres).
- **Dates are `YYYY-MM-DD` strings** in `APP_TZ`; "today" = `todayISO()`. Use helpers in `src/lib/dates.ts` (`addDays`, `addMonths`, `addMonthsToDate` clamps day, `monthRange`, `isoToLocalDate`/`localDateToISO` for date pickers). Never `new Date(iso)` for calendar logic.
- **No data → "—", never ₹0** (₹0 is a value). Totals of positive amounts use `formatTotalINR` (0 ⇒ `NO_DATA`); balance uses `DashboardData.balanceKnown` (`settings.balance_set_at` set by `setBalance`, or any spend/income). New accounts start with zero budgets and the UI shows "Set amount".
- **Balance** = `settings.balance_adjustment` + Σ income − Σ spends up to today; "correct balance" only changes the adjustment.
- **Goal contributions** are virtual (earmarked, not spent); `contributeToGoal` locks the goal row `FOR UPDATE` and caps at the remaining target.
- **Bills / reminders** (`bill` rows share `series_id`; a paid occurrence = a `transaction` with `bill_id`, unique):
  - Ticking paid creates the spend (dated today) and, for Monthly/Yearly, the next occurrence (`on conflict do nothing`).
  - Occurrences are paid **in order** — server rejects paying while an earlier one in the series is unpaid; UI disables that checkbox.
  - Unticking deletes the spend and the auto-created next occurrence if it's still unpaid.
  - `updateBill` edits only unpaid occurrences; `deleteBill` removes this + later **unpaid** occurrences (paid history stays — deleting a paid bill would cascade-delete its spend).
  - Dashboard "Coming up" query returns only the earliest unpaid occurrence per series (+ paid ones in the viewed month); safe-to-spend uses that list.
- Safe-to-spend = floor((budget left − bills still due this month − goal top-ups due) / days left, to ₹100). Formulas live in `finance.ts` and are unit-tested — change them there and extend the tests.

## Security rules

- Every query/action filters by the session user id from `requireUserId()`; never accept a user id from the client.
- Composite FKs `(id, user_id)` stop cross-user references at the DB level; CHECK constraints back zod (positive amounts, lengths, hex colour, `ri-` icon). Keep both layers when adding tables.
- Action pattern: `const _x = action(zodSchema, async (userId, data) => …); export async function x(input) { return _x(input); }`. Throw `UserError` for messages safe to show; other errors become a generic message (23505/23503 mapped). Return `{ ok, data | error }`.
- In any `try/catch` around request APIs (`headers()`, session), call `unstable_rethrow(err)` first or Next's prerender bailouts get swallowed.
- API routes: `Cache-Control: private, no-store`, 401 when signed out, validate params (ISO dates round-tripped, span capped).
- Auth: better-auth with `nextCookies()`, min password 10, rate limiting on, 14-day sessions, `DISABLE_SIGNUP=true` closes registration. New users get default settings/categories via `databaseHooks.user.create.after` → `provisionNewUser`.
- Security headers live in `next.config.ts`.

## Client data flow

- `AppFrame` (components/dashboard/app-shell.tsx) lives in the `(app)` layout, so the header stays mounted across navigation; the active page comes from the URL (`pageFromPath`) and the nav highlights the clicked item at once. It loads `useDashboard(month)` (overview: store month; other pages: current month) and pages read it with `useAppData()` → `{ data, summary, failed, retry }`.
- **No whole-page skeletons.** `data` is undefined until the first response: render what doesn't need it (titles, pickers, search) and give each data-driven card its own `Spinner` / `LoadingPanel` (primitives), per request (e.g. Transactions: table waits on ledger + dashboard, totals on ledger). `LoadFailed` for a failed first load.
- Mutations: `useAction(serverAction, { success })` → toasts errors, invalidates `["dashboard"]`. Any new query key must start with `"dashboard"` (e.g. `["dashboard","ledger",from,to]`) so mutations refresh it.
- Sessions read on the server must sit inside `<Suspense>` (cacheComponents). 401 from the API → AppShell redirects to `/sign-in`.

## UI conventions

- Colour tokens: use `--p-*` (`--p-ink`, `--p-fg2`, `--p-fg3`, `--p-line`, `--p-surface2`, `--p-accent` coral, `--p-pos`, `--p-warn`, …) via Tailwind `text-(--p-fg3)` etc. `globals.css` re-points uiarc tokens (`--accent`, `--surface`, …) at them. Dark mode = `data-theme="dark"` on `<html>` (next-themes), variant `dark:`.
- Primitives (`components/dashboard/primitives.tsx`): `Panel`, `SectionHeader`, `Segmented` (arc Tabs), `Chip` (arc Badge + colour dot), `AmountEdit` (arc InlineEdit, saves paise), `EmptyState` (static uiarc empty-state art), `ProgressBar`, `Stat`, `Kbd`, `Logo`. `CategoryDonut` = arc DonutChart with our own legend (the built-in legend breaks in narrow columns).
- List pages pattern (Transactions/Reminders): title row with DateRangePicker (range in URL `?from&to`) → Panel with SearchField + FilterToolbar (chip `value` is the option **label**; map back to a predicate) + SortableDataTable (we sort/paginate the full list ourselves, 25/page, and pass `defaultSort`) + Pagination → aside with `Stat`s and `CategoryDonut`.
- Overview order: title + MonthPicker (popover month grid) → Hero → Spending (chart + by category) → Recent | Coming up (equal-height cards, max 6 open reminders, "View all") → Income → Wishlist → Budgets.
- Header: logo, nav (Overview / Transactions / Reminders), ExpandingSearch (wrapped in a fixed-width div so results aren't cramped), Add (Ctrl/⌘K), ThemeSwitch (round, View Transitions reveal), sign out. Mobile: nav row under the header, FAB for add.
- Dialog content with a MorphSelect inside: add `[@media(min-height:720px)]:overflow-visible!` so the list isn't clipped. Use `onOpenAutoFocus={e => e.preventDefault()}` when you focus a field yourself.
- Tailwind utilities lose to unlayered CSS-module rules — use the `!` suffix to override uiarc styles.
- **Mobile** (checked at 360 / 390 / 768 / 1280): no horizontal scroll at any width. `Segmented fill` stretches tabs to the container instead of side-scrolling. Hover-only reveals are gated on `[@media(hover:hover)_and_(pointer:fine)]`, never on a width breakpoint (touch tablets can't hover). Use `<TapOrClick />` in "Click to…" hints. List-page tables get `.list-table` (rules in `globals.css`) so phone cards stay two tidy lines. On touch screens, text inputs are forced to ≥16px (iOS focus zoom). On phones the tour tip is pinned to the bottom and targets scroll to the top (`[data-tour]` scroll-margin).

## uiarc notes

- Add components with `npx shadcn@latest add @uiarc/<name>` (registry in `components.json`; full catalogue at `https://uiarc.dev/r/registry.json`). Read the copied source for props — they differ from shadcn.
- Local fixes to re-apply if a component is re-installed:
  - `dialog`, `tabs`: `render={<motion.div/>}` → `asChild` + `<motion.div>` child (Radix 1.3 has no `render`). `tooltip`: Trigger needs `asChild`.
  - `date-range-picker`: a document-level Escape listener while open (opening leaves focus on `<body>`, so the root's onKeyDown missed it).
  - `morph-select.tsx`: opening a searchable list doesn't focus the search field on touch screens (`pointer: coarse`), so the keyboard doesn't cover the list.
  - `morph-select.module.css`: `.options`/`.group` `grid-template-columns: minmax(0,1fr)` and `.option { min-width: 0 }` so long labels/meta don't overflow the panel.
- `next.config.ts` keeps `@tailwindcss/turbopack` off `*.module.css` (uiarc modules use `:global()`).
- `DonutChart` root is a size container: don't put it in an `items-center` flex column (it collapses to 0 width).

## Verifying UI changes

- Browser checks use playwright-core at `/Users/mohammed.yaseen/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core` (run scripts with `PW=<that path> node script.cjs`; examples in `/tmp/paisa-e2e/`). Sign in as the demo account; wait for `nav[aria-label=Pages]` (on mobile use `.last()` — the desktop nav is hidden), not for "Safe to spend today" (that text is also on the sign-in decor).
- If the owner's dev server is already on :3000, test against it instead of starting another.
