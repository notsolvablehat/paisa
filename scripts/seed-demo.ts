/**
 * Creates (or resets) a demo account filled with the data from the design.
 *   npm run db:seed                       → demo@paisa.local
 *   npm run db:seed -- you@example.com    → that account (must already exist)
 * Dates are placed relative to today so the dashboard always looks "live".
 */
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { DEFAULT_BUDGETS, DEFAULT_CATEGORIES } from "../src/lib/constants";
import { addMonths, addMonthsToDate, daysInMonth, monthKey, parseISO, todayISO } from "../src/lib/dates";

const P = (r: number) => r * 100;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const DEMO_EMAIL = "demo@paisa.local";
const DEMO_PASSWORD = "paisa-demo-123";

async function ensureUser(email: string): Promise<string> {
  const [u] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email));
  if (u) return u.id;
  if (email !== DEMO_EMAIL) throw new Error(`No account for ${email}. Sign up in the app first.`);
  const res = await fetch(`${process.env.BETTER_AUTH_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: process.env.BETTER_AUTH_URL! },
    body: JSON.stringify({ email, password: DEMO_PASSWORD, name: "Demo" }),
  });
  if (!res.ok) throw new Error(`Sign-up failed (${res.status}). Is \`npm run dev\` running? ${await res.text()}`);
  const [created] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email));
  return created.id;
}

async function main() {
  const email = process.argv[2] ?? DEMO_EMAIL;
  const userId = await ensureUser(email);
  const today = todayISO();
  const { y, m, d: T } = parseISO(today);
  const day = (d: number, month = monthKey(y, m)) => {
    const p = parseISO(month);
    return `${month}-${String(Math.min(d, daysInMonth(p.y, p.m))).padStart(2, "0")}`;
  };
  // Clamp "day n of this month" to today so nothing lands in the future.
  const past = (d: number) => day(Math.min(d, T));

  await db.transaction(async (tx) => {
    // Wipe this user's app data (not their login).
    await tx.delete(schema.goal).where(eq(schema.goal.userId, userId));
    await tx.delete(schema.transaction).where(eq(schema.transaction.userId, userId));
    await tx.delete(schema.bill).where(eq(schema.bill.userId, userId));
    await tx.delete(schema.income).where(eq(schema.income.userId, userId));
    await tx.delete(schema.category).where(eq(schema.category.userId, userId));
    await tx.delete(schema.settings).where(eq(schema.settings.userId, userId));

    await tx.insert(schema.settings).values({
      userId,
      monthlyBudget: P(DEFAULT_BUDGETS.monthly),
      dailyBudget: P(DEFAULT_BUDGETS.daily),
      hardLimit: P(DEFAULT_BUDGETS.hard),
    });
    const cats = await tx
      .insert(schema.category)
      .values(DEFAULT_CATEGORIES.map((c) => ({ userId, name: c.name, icon: c.icon, color: c.color, budget: P(c.budget) })))
      .returning({ id: schema.category.id, name: schema.category.name });
    const C = Object.fromEntries(cats.map((c) => [c.name, c.id])) as Record<string, string>;

    // This month's spends (from the design).
    const spends: [number, string, number, string][] = [
      [1, "Rent", 7000, "Rent"],
      [1, "Food", 420, "Breakfast at Vidyarthi Bhavan"],
      [2, "Transport", 312, "Uber to office"],
      [3, "Groceries", 486, "Zepto · vegetables and milk"],
      [4, "Shopping", 1866, "Running shoes"],
      [5, "Food", 240, "Lunch with Ananya"],
      [6, "Groceries", 754, "BigBasket weekly order"],
      [6, "Transport", 151, "Metro card top-up"],
      [7, "Food", 580, "Swiggy · biryani"],
      [7, "Entertainment", 600, "Movie tickets"],
      [8, "Food", 362, "Coffee with the team"],
      [9, "Food", 615, "Dinner in Indiranagar"],
      [10, "Food", 603, "Swiggy · dinner"],
      [10, "Transport", 217, "Rapido home"],
    ];
    await tx.insert(schema.transaction).values(
      spends.map(([d, c, amt, note]) => ({ userId, categoryId: C[c], amount: P(amt), note, occurredOn: past(d) })),
    );

    // History: 11 previous months + 2 earlier years, as single lump spends.
    const histSpend = [24800, 27100, 22900, 25600, 29800, 23400, 26200, 28900, 24100, 27600, 25300];
    const histInc = [23800, 24500, 22000, 26300, 24000, 25200, 24700, 29000, 23000, 32900, 26000];
    const cur = monthKey(y, m);
    for (let i = 0; i < 11; i++) {
      const mo = addMonths(cur, i - 11);
      await tx.insert(schema.transaction).values([
        { userId, categoryId: C.Rent, amount: P(7000), note: "Rent", occurredOn: day(1, mo) },
        { userId, categoryId: C.Food, amount: P(histSpend[i] - 7000), note: "Month total (imported)", occurredOn: day(15, mo) },
      ]);
      await tx.insert(schema.income).values([
        { userId, source: "Salary", amount: P(20000), note: "Salary", receivedOn: day(1, mo) },
        { userId, source: "Freelance", amount: P(histInc[i] - 20000), note: "Freelance work", receivedOn: day(18, mo) },
      ]);
    }
    for (const [yr, sp, inc] of [[y - 2, 264000, 288000], [y - 1, 302000, 324000]] as const) {
      // Only months not already covered above.
      const covered = new Set(Array.from({ length: 11 }, (_, i) => addMonths(cur, i - 11)));
      const months = Array.from({ length: 12 }, (_, i) => monthKey(yr, i + 1)).filter((mo) => !covered.has(mo));
      if (!months.length) continue;
      const share = Math.round(sp / 12), ishare = Math.round(inc / 12);
      for (const mo of months) {
        await tx.insert(schema.transaction).values({ userId, categoryId: C.Food, amount: P(share), note: "Imported", occurredOn: day(10, mo) });
        await tx.insert(schema.income).values({ userId, source: "Salary", amount: P(ishare), note: "Imported", receivedOn: day(1, mo) });
      }
    }

    // This month's income.
    await tx.insert(schema.income).values([
      { userId, source: "Salary", amount: P(20000), note: `${new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date())} salary`, receivedOn: past(1) },
      { userId, source: "Freelance", amount: P(4000), note: "Logo project · Kaveri Foods", receivedOn: past(5) },
      { userId, source: "Freelance", amount: P(2500), note: "Landing page revisions", receivedOn: past(8) },
    ]);

    // Bills around today.
    const bills: [string, number, number, "Monthly" | "Yearly", string][] = [
      ["Water · BWSSB", -3, 180, "Monthly", "Bills"],
      ["Electricity · BESCOM", 2, 1420, "Monthly", "Bills"],
      ["Netflix", 3, 649, "Monthly", "Subscriptions"],
      ["Airtel broadband", 5, 799, "Monthly", "Bills"],
      ["Jio mobile", 7, 399, "Monthly", "Bills"],
      ["Cult.fit membership", 9, 1583, "Monthly", "Health"],
      ["Spotify", 17, 119, "Monthly", "Subscriptions"],
    ];
    const rel = (n: number) => {
      const dt = new Date(Date.UTC(y, m - 1, T + n));
      return dt.toISOString().slice(0, 10);
    };
    await tx.insert(schema.bill).values(
      bills.map(([name, off, amt, rec, c]) => ({ userId, name, amount: P(amt), dueOn: rel(off), recurrence: rec, categoryId: C[c] })),
    );
    await tx.insert(schema.bill).values({
      userId, name: "Domain renewal", amount: P(899), recurrence: "Yearly", categoryId: C.Subscriptions,
      dueOn: addMonthsToDate(day(3), 2),
    });

    // Goals + contributions.
    const goals = await tx
      .insert(schema.goal)
      .values([
        { userId, name: "MacBook Air M4", target: P(99900), monthly: P(6000) },
        { userId, name: "Goa trip with college friends", target: P(25000), monthly: P(2500) },
        { userId, name: "Emergency cushion", target: P(50000), monthly: P(2000) },
      ])
      .returning({ id: schema.goal.id, name: schema.goal.name });
    const G = Object.fromEntries(goals.map((g) => [g.name, g.id]));
    const prev = addMonths(cur, -1);
    await tx.insert(schema.goalContribution).values([
      { userId, goalId: G["MacBook Air M4"], amount: P(32500), contributedOn: day(20, prev) },
      { userId, goalId: G["MacBook Air M4"], amount: P(5500), contributedOn: past(2) },
      { userId, goalId: G["Goa trip with college friends"], amount: P(4000), contributedOn: day(20, prev) },
      { userId, goalId: G["Goa trip with college friends"], amount: P(2500), contributedOn: past(2) },
      { userId, goalId: G["Emergency cushion"], amount: P(2000), contributedOn: past(2) },
    ]);
  });

  // Make "current balance" read ₹62,400 like the design.
  await db.execute(sql`
    update settings set balance_adjustment = ${P(62400)}
      - coalesce((select sum(amount) from income where user_id = ${userId} and received_on <= ${today}), 0)
      + coalesce((select sum(amount) from "transaction" where user_id = ${userId} and occurred_on <= ${today}), 0)
    where user_id = ${userId}`);

  console.log(`Seeded ${email}${email === DEMO_EMAIL ? ` (password: ${DEMO_PASSWORD})` : ""}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
