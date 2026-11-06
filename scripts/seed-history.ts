/**
 * Fills an existing account with ~5 months of realistic, synthetic history
 * (1 Jun → today): daily spends, salary + side income, paid recurring bills,
 * goals with monthly contributions. Deterministic (seeded RNG).
 *
 *   npm run db:seed:history -- you@example.com
 *
 * Wipes that user's spends / income / bills / goals first. Keeps their login,
 * categories and budgets.
 */
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { addDays, addMonthsToDate, parseISO, todayISO } from "../src/lib/dates";

const START = "2026-06-01";
const OPENING_BALANCE = 74_250; // rupees in the account on START

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

/* ── deterministic randomness ── */
let seed = 0x9e3779b9;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const chance = (p: number) => rand() < p;
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
/** Whole rupees in [lo, hi] → paise. */
const rs = (lo: number, hi: number) => Math.round(lo + rand() * (hi - lo)) * 100;
/** Rupees with paise (cab fares, pharmacy bills). */
const rsp = (lo: number, hi: number) => Math.round((lo + rand() * (hi - lo)) * 100);

type Spend = { cat: string; amount: number; note: string; date: string; billKey?: string };

const weekday = (iso: string) => {
  const { y, m, d } = parseISO(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun
};

function dailySpends(date: string): Spend[] {
  const out: Spend[] = [];
  const wd = weekday(date);
  const weekend = wd === 0 || wd === 6;
  const add = (cat: string, amount: number, note: string) => out.push({ cat, amount, note, date });

  // Food
  if (!weekend && chance(0.3)) add("Food", rs(140, 290), pick(["Lunch near office", "Lunch · Meghana's", "Office canteen", "Lunch · Truffles"]));
  if (chance(0.12)) add("Food", rs(220, 380), pick(["Coffee · Third Wave", "Coffee · Blue Tokai", "Coffee with the team"]));
  if (chance(0.09)) add("Food", rs(330, 640), pick(["Swiggy · biryani", "Zomato · dinner", "Swiggy · pizza", "Zomato · momos"]));
  if (weekend && chance(0.25)) add("Food", rs(650, 1650), pick(["Dinner in Indiranagar", "Brunch at Koramangala", "Dinner with friends", "Breakfast · Vidyarthi Bhavan"]));
  if (chance(0.06)) add("Food", rs(40, 120), "Chai & snacks");

  // Groceries
  if (wd === 6 && chance(0.45)) add("Groceries", rs(850, 1800), pick(["BigBasket weekly order", "DMart run"]));
  if (chance(0.09)) add("Groceries", rs(180, 560), pick(["Zepto · vegetables and milk", "Blinkit · essentials", "Zepto · fruits"]));

  // Transport
  if (!weekend && chance(0.38)) add("Transport", rsp(170, 340), pick(["Uber to office", "Uber to office", "Namma Yatri auto"]));
  if (!weekend && chance(0.18)) add("Transport", rsp(60, 160), "Rapido home");
  if (weekend && chance(0.3)) add("Transport", rsp(120, 380), pick(["Uber", "Namma Yatri auto"]));

  // Occasional
  if (chance(0.045)) {
    const [note, amt] = pick([
      ["Amazon · phone case", 499], ["Myntra · t-shirts", 1298], ["Decathlon · running socks", 699],
      ["Amazon · kitchen stuff", 864], ["Uniqlo · chinos", 2490], ["Amazon · USB-C cable", 349],
    ] as const);
    add("Shopping", amt * 100, note);
  }
  if (weekend && chance(0.18)) add("Entertainment", rs(350, 720), pick(["BookMyShow · movie", "Bowling at Smaaash", "Board game café"]));
  if (chance(0.03)) add("Health", rsp(110, 640), "Apollo Pharmacy");
  return out;
}

/** One-off, dated events that make the history feel lived-in. */
const EVENTS: Spend[] = [
  { cat: "Education", amount: 449_00, note: "Udemy · TypeScript course", date: "2026-06-14" },
  { cat: "Health", amount: 800_00, note: "Dentist check-up", date: "2026-06-23" },
  { cat: "Shopping", amount: 1_490_00, note: "IKEA · desk lamp", date: "2026-07-05" },
  { cat: "Entertainment", amount: 2_499_00, note: "Concert tickets · Prateek Kuhad", date: "2026-07-11" },
  { cat: "Travel", amount: 1_240_00, note: "KSRTC bus to Madikeri", date: "2026-08-14" },
  { cat: "Travel", amount: 5_400_00, note: "Coorg · homestay, 2 nights", date: "2026-08-14" },
  { cat: "Travel", amount: 1_850_00, note: "Coorg · food & coffee estate tour", date: "2026-08-16" },
  { cat: "Education", amount: 1_120_00, note: "Books · Blossom Book House", date: "2026-08-29" },
  { cat: "Health", amount: 1_350_00, note: "Blood tests · annual", date: "2026-09-12" },
  { cat: "Shopping", amount: 3_299_00, note: "Amazon · Great Indian Festival · mixer", date: "2026-09-27" },
  { cat: "Travel", amount: 4_860_00, note: "IndiGo · BLR→HYD for Diwali", date: "2026-10-12" },
  { cat: "Entertainment", amount: 799_00, note: "Steam sale", date: "2026-10-18" },
  { cat: "Shopping", amount: 2_150_00, note: "Diwali gifts · Commercial Street", date: "2026-11-05" },
  { cat: "Shopping", amount: 1_480_00, note: "Diya, lights & sweets", date: "2026-11-06" },
];

/* ── recurring bills: name, category, due day, amount per occurrence ── */
type Series = { name: string; cat: string; day: number; amount: (month: string) => number; recurrence: "Monthly" | "Yearly" | "Once"; first?: string; leaveUnpaidFrom?: string };
const ELECTRICITY: Record<string, number> = { "06": 1640, "07": 1380, "08": 1290, "09": 1240, "10": 1310, "11": 1180, "12": 1150 };
const SERIES: Series[] = [
  { name: "Rent", cat: "Rent", day: 1, amount: () => 7_000_00, recurrence: "Monthly" },
  { name: "Airtel broadband", cat: "Bills", day: 5, amount: () => 799_00, recurrence: "Monthly" },
  { name: "Water · BWSSB", cat: "Bills", day: 5, amount: (mo) => (180 + (Number(mo.slice(5)) % 3) * 15) * 100, recurrence: "Monthly", leaveUnpaidFrom: "2026-11-01" },
  { name: "Electricity · BESCOM", cat: "Bills", day: 7, amount: (mo) => ELECTRICITY[mo.slice(5)] * 100, recurrence: "Monthly" },
  { name: "iCloud+ 200 GB", cat: "Subscriptions", day: 9, amount: () => 219_00, recurrence: "Monthly" },
  { name: "Cult.fit membership", cat: "Health", day: 10, amount: () => 1_583_00, recurrence: "Monthly" },
  { name: "Jio mobile", cat: "Bills", day: 12, amount: () => 399_00, recurrence: "Monthly" },
  { name: "Netflix", cat: "Subscriptions", day: 18, amount: () => 649_00, recurrence: "Monthly" },
  { name: "Spotify", cat: "Subscriptions", day: 22, amount: () => 119_00, recurrence: "Monthly" },
  { name: "Domain renewal · yaseen.dev", cat: "Subscriptions", day: 14, amount: () => 899_00, recurrence: "Yearly", first: "2027-01-14" },
  { name: "Passport renewal fee", cat: "Bills", day: 21, amount: () => 1_500_00, recurrence: "Once", first: "2026-11-21" },
];

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: npm run db:seed:history -- <email>");
  const [u] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email));
  if (!u) throw new Error(`No account for ${email}`);
  const userId = u.id;
  const today = todayISO();

  const cats = await db.select({ id: schema.category.id, name: schema.category.name }).from(schema.category).where(eq(schema.category.userId, userId));
  const C = Object.fromEntries(cats.map((c) => [c.name, c.id])) as Record<string, string>;
  const need = ["Rent", "Food", "Groceries", "Transport", "Shopping", "Bills", "Entertainment", "Health", "Travel", "Education", "Subscriptions"];
  const missing = need.filter((n) => !C[n]);
  if (missing.length) throw new Error(`Account is missing categories: ${missing.join(", ")}`);

  const days: string[] = [];
  for (let d = START; d <= today; d = addDays(d, 1)) days.push(d);
  const months = [...new Set(days.map((d) => d.slice(0, 7)))];

  /* spends */
  // Keep each month's everyday spending believable (~₹16k, less when a trip/big buy happened).
  const events = EVENTS.filter((e) => e.date <= today);
  const daily = days.flatMap(dailySpends);
  for (const mo of months) {
    const eventSpend = events.filter((e) => e.date.startsWith(mo)).reduce((a, e) => a + e.amount, 0);
    const cap = 16_000_00 - eventSpend / 2;
    let total = daily.filter((s) => s.date.startsWith(mo)).reduce((a, s) => a + s.amount, 0);
    while (total > cap) {
      const idx = daily.map((s, i) => (s.date.startsWith(mo) ? i : -1)).filter((i) => i >= 0);
      const [removed] = daily.splice(pick(idx), 1);
      total -= removed.amount;
    }
  }
  const spends: Spend[] = [...daily, ...events];
  for (const mo of months) {
    const d = `${mo}-0${1 + Math.floor(rand() * 4)}`;
    if (d <= today) spends.push({ cat: "Transport", amount: rs(300, 500), note: "Metro card top-up", date: d });
  }

  /* income */
  const income: (typeof schema.income.$inferInsert)[] = [];
  const monthName = (mo: string) => new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(new Date(`${mo}-01T00:00:00Z`));
  const freelance = [
    "Logo project · Kaveri Foods", "Landing page · Brewbay", "Pitch deck design · Fintrail", "Website revisions · Studio Nila",
    "Brand guidelines · Hoysala Tea", "Webflow build · Dhaga", "Icon set · Kitchenly", "UX audit · PetPal",
  ];
  let fi = 0;
  for (const mo of months) {
    const at = (d: number) => `${mo}-${String(d).padStart(2, "0")}`;
    const push = (source: (typeof schema.incomeSource.enumValues)[number], amount: number, note: string, d: string) => {
      if (d <= today) income.push({ userId, source, amount, note, receivedOn: d });
    };
    push("Salary", 52_000_00, `${monthName(mo)} salary`, at(1));
    const gigs = 1 + (chance(0.5) ? 1 : 0);
    for (let g = 0; g < gigs; g++) push("Freelance", rs(3, 11) * 1000, freelance[fi++ % freelance.length], at(6 + Math.floor(rand() * 20)));
    for (let s = 0; s < 1 + Math.floor(rand() * 3); s++)
      push("Side projects", pick([299, 299, 499, 499, 999]) * 100, "Gumroad · Notion budget template", at(2 + Math.floor(rand() * 26)));
    if (chance(0.7)) push("Other", rs(120, 420), "Cashback · HDFC card", at(10 + Math.floor(rand() * 15)));
  }
  income.push({ userId, source: "Other", amount: 1_250_00, note: "Splitwise · Rahul settled Coorg trip", receivedOn: "2026-08-21" });
  income.push({ userId, source: "Salary", amount: 15_000_00, note: "Diwali bonus", receivedOn: "2026-10-28" });

  await db.transaction(async (tx) => {
    await tx.delete(schema.goal).where(eq(schema.goal.userId, userId));
    await tx.delete(schema.transaction).where(eq(schema.transaction.userId, userId));
    await tx.delete(schema.bill).where(eq(schema.bill.userId, userId));
    await tx.delete(schema.income).where(eq(schema.income.userId, userId));

    await tx.insert(schema.transaction).values(
      spends.map((s) => ({ userId, categoryId: C[s.cat], amount: s.amount, note: s.note, occurredOn: s.date })),
    );
    await tx.insert(schema.income).values(income);

    /* bills: past occurrences paid (spend linked to the bill), then the next open one */
    let paidBills = 0;
    for (const s of SERIES) {
      const seriesId = crypto.randomUUID();
      let due = s.first ?? `${START.slice(0, 8)}${String(s.day).padStart(2, "0")}`;
      for (;;) {
        const amount = s.amount(due.slice(0, 7));
        const [b] = await tx
          .insert(schema.bill)
          .values({ userId, seriesId, name: s.name, amount, dueOn: due, recurrence: s.recurrence, categoryId: C[s.cat] })
          .returning({ id: schema.bill.id });
        const paid = due < today && !(s.leaveUnpaidFrom && due >= s.leaveUnpaidFrom);
        if (!paid || s.recurrence === "Once") break;
        const early = addDays(due, -1);
        const paidOn = chance(0.3) && early >= START ? early : due;
        await tx.insert(schema.transaction).values({ userId, categoryId: C[s.cat], amount, note: s.name, occurredOn: paidOn, billId: b.id });
        paidBills++;
        due = addMonthsToDate(due, s.recurrence === "Yearly" ? 12 : 1);
      }
    }

    /* goals: started at different times, topped up on the 2nd of each month */
    const goals = [
      { name: "Emergency fund", target: 1_50_000_00, monthly: 6_000_00, from: "2026-06", opening: 20_000_00 },
      { name: "Royal Enfield Hunter 350", target: 1_75_000_00, monthly: 8_000_00, from: "2026-07" },
      { name: "Sony WH-1000XM6", target: 32_990_00, monthly: 4_000_00, from: "2026-08" },
      { name: "Goa trip in December", target: 18_000_00, monthly: 6_000_00, from: "2026-09" },
    ];
    let contributions = 0;
    for (const g of goals) {
      const [row] = await tx.insert(schema.goal).values({ userId, name: g.name, target: g.target, monthly: g.monthly }).returning({ id: schema.goal.id });
      let left = g.target;
      const rows: (typeof schema.goalContribution.$inferInsert)[] = [];
      if (g.opening) {
        rows.push({ userId, goalId: row.id, amount: g.opening, contributedOn: `${g.from}-01`, note: "Moved from savings" });
        left -= g.opening;
      }
      for (const mo of months.filter((m) => m >= g.from)) {
        const d = `${mo}-02`;
        const amt = Math.min(g.monthly, left);
        if (d > today || amt <= 0) continue;
        rows.push({ userId, goalId: row.id, amount: amt, contributedOn: d });
        left -= amt;
      }
      if (rows.length) await tx.insert(schema.goalContribution).values(rows);
      contributions += rows.length;
    }

    /* balance = opening + Σ income − Σ spends (only the adjustment is stored) */
    await tx
      .insert(schema.settings)
      .values({ userId, balanceAdjustment: OPENING_BALANCE * 100 })
      .onConflictDoUpdate({ target: schema.settings.userId, set: { balanceAdjustment: OPENING_BALANCE * 100, updatedAt: sql`now()` } });

    console.log(
      `Seeded ${email}: ${spends.length + paidBills} spends (${paidBills} bill payments), ${income.length} income, ` +
        `${SERIES.length} bill series, ${goals.length} goals / ${contributions} contributions, ${START} → ${today}`,
    );
  });

  const totals = await db.execute<{ month: string; spent: string; income: string }>(sql`
    select m.month,
      coalesce((select sum(amount) from "transaction" t where t.user_id = ${userId} and to_char(t.occurred_on,'YYYY-MM') = m.month),0)/100 as spent,
      coalesce((select sum(amount) from income i where i.user_id = ${userId} and to_char(i.received_on,'YYYY-MM') = m.month),0)/100 as income
    from (select distinct to_char(occurred_on,'YYYY-MM') as month from "transaction" where user_id = ${userId}) m order by 1`);
  console.table(totals.rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
