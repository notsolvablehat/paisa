/**
 * Pure calculations behind the dashboard. No I/O, no React — easy to test.
 * All amounts are paise.
 */
import { INCOME_SOURCES } from "./constants";
import { diffDays, monthRange, parseISO, MONTHS_SHORT, addMonths } from "./dates";
import type { Bill, Category, DashboardData, Goal } from "./types";

export type MonthPhase = "past" | "current" | "future";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function monthPhase(month: string, today: string): MonthPhase {
  const cur = today.slice(0, 7);
  return month < cur ? "past" : month > cur ? "future" : "current";
}

/** What this goal still needs this month (its monthly amount, capped by what's left overall). */
export function goalDueThisMonth(g: Pick<Goal, "target" | "assigned" | "monthly" | "contributedInMonth">): number {
  const remainingAtMonthStart = Math.max(0, g.target - g.assigned + g.contributedInMonth);
  const commitment = Math.min(g.monthly, remainingAtMonthStart);
  return Math.max(0, commitment - g.contributedInMonth);
}

export function computeSummary(d: DashboardData) {
  const { start, end, days: dim } = monthRange(d.month);
  const phase = monthPhase(d.month, d.today);
  const todayDay = parseISO(d.today).d;

  /** Day-of-month that is "today" in this view (1-based). */
  const T = phase === "current" ? todayDay : phase === "past" ? dim + 1 : 0;
  const elapsedDays = phase === "current" ? todayDay - 1 : phase === "past" ? dim : 0;
  const daysLeft = phase === "current" ? dim - todayDay + 1 : phase === "past" ? 0 : dim;

  const B = d.settings;
  const spent = sum(d.transactions.map((t) => t.amount));
  const incomeTotal = sum(d.income.map((i) => i.amount));
  const budgetLeft = B.monthlyBudget - spent;

  const billsDue = sum(
    d.bills
      .filter((b) => !b.paid && b.dueOn <= end && (phase !== "future" || b.dueOn >= start))
      .map((b) => b.amount),
  );
  const goalTop = sum(d.goals.map(goalDueThisMonth));

  const pool = budgetLeft - billsDue - goalTop;
  // Floor to whole rupees so we never suggest more than is actually safe.
  const safe = daysLeft > 0 ? Math.max(0, Math.floor(pool / daysLeft / 100) * 100) : 0;

  const earmarked = sum(d.goals.map((g) => g.assigned));

  const daily = Array.from({ length: dim }, () => 0);
  for (const t of d.transactions) daily[parseISO(t.date).d - 1] += t.amount;
  const incDaily = Array.from({ length: dim }, () => 0);
  for (const i of d.income) incDaily[parseISO(i.date).d - 1] += i.amount;

  const usedPct =
    B.monthlyBudget > 0 ? Math.min(100, Math.round((spent / B.monthlyBudget) * 100)) : spent > 0 ? 100 : 0;
  const elapsedPct = Math.round((elapsedDays / dim) * 100);
  const todaySpent = phase === "current" ? daily[todayDay - 1] : 0;
  const avgDaily = elapsedDays > 0 ? sum(daily.slice(0, elapsedDays)) / elapsedDays : 0;

  return {
    phase, dim, T, elapsedDays, daysLeft,
    spent, incomeTotal, budgetLeft, billsDue, goalTop, safe,
    balance: d.balance, earmarked, free: d.balance - earmarked,
    daily, incDaily, usedPct, elapsedPct, todaySpent, avgDaily,
  };
}
export type Summary = ReturnType<typeof computeSummary>;

/* ───────────────────────────── categories ───────────────────────────── */

export type CategoryRow = Category & { spent: number; over: boolean; pct: number; ratio: number };

export function categoryRows(categories: Category[], transactions: DashboardData["transactions"]): CategoryRow[] {
  const spentBy = new Map<string, number>();
  for (const t of transactions) spentBy.set(t.categoryId, (spentBy.get(t.categoryId) ?? 0) + t.amount);
  return categories
    .map((c) => {
      const spent = spentBy.get(c.id) ?? 0;
      const ratio = c.budget > 0 ? spent / c.budget : 0;
      return { ...c, spent, ratio, over: c.budget > 0 && spent > c.budget, pct: Math.min(100, ratio * 100) };
    })
    .filter((c) => c.budget > 0 || c.spent > 0)
    .sort((a, b) => b.spent - a.spent || b.budget - a.budget);
}

/** Plain-language warnings under the hero. Returns [] when all is well. */
export function budgetNotes(s: Summary, rows: CategoryRow[], hardLimit: number, fmt: (p: number) => string): string[] {
  const parts: string[] = [];
  if (hardLimit > 0 && s.spent >= hardLimit) parts.push(`You are ${fmt(s.spent - hardLimit)} past your hard limit.`);
  else if (hardLimit > 0 && s.spent >= hardLimit * 0.85) parts.push(`You are ${fmt(hardLimit - s.spent)} from your hard limit.`);
  const overs = rows.filter((r) => r.over);
  if (overs.length === 1) parts.push(`${overs[0].name} is over budget by ${fmt(overs[0].spent - overs[0].budget)}.`);
  else if (overs.length > 1) parts.push(`${overs.map((r) => r.name).join(" and ")} are over budget.`);
  const near = rows.find((r) => !r.over && r.ratio >= 0.9 && r.ratio < 1);
  if (near && s.phase === "current")
    parts.push(`${near.name} is at ${Math.round(near.ratio * 100)}% of its budget with ${s.daysLeft} days to go.`);
  return parts;
}

/* ───────────────────────────── chart ───────────────────────────── */

export type Range = "day" | "week" | "month" | "year";
export type Bar = {
  value: number;
  income: number;
  label: string;
  title: string;
  future: boolean;
  today: boolean;
  over: boolean;
};
export type Chart = {
  bars: Bar[];
  scaleMax: number;
  line: number[] | null;
  budgetLine: number | null;
  budgetLineLabel: string;
  caption: string;
  total: number;
  incomeMarks: { index: number; value: number }[];
};

export function buildChart(range: Range, d: DashboardData, s: Summary, fmt: (p: number) => string): Chart {
  const B = d.settings;
  const { m, y } = parseISO(d.month);
  const mon = MONTHS_SHORT[m - 1];
  const monthLong = new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(Date.UTC(y, m - 1, 1));
  const safeMax = (xs: number[]) => Math.max(1, ...xs);

  if (range === "day") {
    const labelled = new Set([1, 5, 10, 15, 20, 25, s.dim]);
    const bars = s.daily.map((v, i) => ({
      value: v,
      income: s.incDaily[i],
      label: labelled.has(i + 1) || i + 1 === s.T ? String(i + 1) : "",
      title: `${i + 1} ${mon}`,
      future: i + 1 > s.T,
      today: i + 1 === s.T,
      over: B.dailyBudget > 0 && v > B.dailyBudget,
    }));
    return {
      bars,
      scaleMax: B.dailyBudget > 0 ? B.dailyBudget * 3 : safeMax(s.daily) * 1.1,
      line: null,
      budgetLine: B.dailyBudget > 0 ? B.dailyBudget : null,
      budgetLineLabel: `Daily budget ${fmt(B.dailyBudget)}`,
      caption: `Spent in ${monthLong}`,
      total: s.spent,
      incomeMarks: s.incDaily.flatMap((v, i) => (v ? [{ index: i, value: v }] : [])),
    };
  }

  if (range === "week") {
    const weeks: [number, number][] = [];
    for (let a = 1; a <= s.dim; a += 7) weeks.push([a, Math.min(a + 6, s.dim)]);
    const vals = weeks.map(([a, b]) => sum(s.daily.slice(a - 1, b)));
    const inc = weeks.map(([a, b]) => sum(s.incDaily.slice(a - 1, b)));
    return {
      bars: weeks.map(([a, b], i) => ({
        value: vals[i],
        income: inc[i],
        label: `Week ${i + 1}`,
        title: `${a}–${b} ${mon}`,
        future: a > s.T,
        today: a <= s.T && b >= s.T,
        over: B.dailyBudget > 0 && vals[i] > B.dailyBudget * (b - a + 1),
      })),
      scaleMax: safeMax([...vals, ...inc, B.dailyBudget * 7]) * 1.1,
      line: inc,
      budgetLine: B.dailyBudget > 0 ? B.dailyBudget * 7 : null,
      budgetLineLabel: `Weekly pace ${fmt(B.dailyBudget * 7)}`,
      caption: `Spent in ${monthLong}`,
      total: s.spent,
      incomeMarks: [],
    };
  }

  if (range === "month") {
    const hist = d.history.months;
    const sp = hist.map((h) => h.spent);
    const inc = hist.map((h) => h.income);
    return {
      bars: hist.map((h, i) => {
        const p = parseISO(h.month);
        return {
          value: h.spent,
          income: h.income,
          label: MONTHS_SHORT[p.m - 1],
          title: `${MONTHS_SHORT[p.m - 1]} ${p.y}`,
          future: h.month > d.today.slice(0, 7),
          today: i === hist.length - 1,
          over: B.monthlyBudget > 0 && h.spent > B.monthlyBudget,
        };
      }),
      scaleMax: safeMax([...sp, ...inc, B.monthlyBudget]) * 1.1,
      line: inc,
      budgetLine: B.monthlyBudget > 0 ? B.monthlyBudget : null,
      budgetLineLabel: `Monthly budget ${fmt(B.monthlyBudget)}`,
      caption: `Spent ${monthLabelRange(hist[0].month, d.month)}`,
      total: sum(sp),
      incomeMarks: [],
    };
  }

  const yrs = d.history.years;
  const sp = yrs.map((h) => h.spent);
  const inc = yrs.map((h) => h.income);
  const cur = yrs[yrs.length - 1];
  return {
    bars: yrs.map((h, i) => ({
      value: h.spent,
      income: h.income,
      label: String(h.year),
      title: i === yrs.length - 1 ? `${h.year} so far` : String(h.year),
      future: false,
      today: i === yrs.length - 1,
      over: false,
    })),
    scaleMax: safeMax([...sp, ...inc]) * 1.1,
    line: inc,
    budgetLine: null,
    budgetLineLabel: "",
    caption: `Spent in ${cur.year} so far`,
    total: cur.spent,
    incomeMarks: [],
  };
}

function monthLabelRange(from: string, to: string) {
  const a = parseISO(from), b = parseISO(to);
  return `${MONTHS_SHORT[a.m - 1]} ${a.y} – ${MONTHS_SHORT[b.m - 1]} ${b.y}`;
}

/* ───────────────────────────── goals ───────────────────────────── */

/** Month the goal completes if the monthly amount is kept up, e.g. "Mar 2027"; "now" if funded. */
export function goalReadyBy(g: Pick<Goal, "target" | "assigned" | "monthly">, month: string): string {
  const rem = g.target - g.assigned;
  if (rem <= 0) return "now";
  const months = Math.ceil(rem / g.monthly);
  const p = parseISO(addMonths(month, months));
  return `${MONTHS_SHORT[p.m - 1]} ${p.y}`;
}

/* ───────────────────────────── bills ───────────────────────────── */

export type BillRow = Bill & { diff: number; overdue: boolean };

export function billRows(bills: Bill[], today: string): BillRow[] {
  return bills
    .map((b) => {
      const diff = diffDays(today, b.dueOn);
      return { ...b, diff, overdue: !b.paid && diff < 0 };
    })
    .sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : a.name.localeCompare(b.name)));
}

export function billsSummary(rows: BillRow[]) {
  return {
    next14: sum(rows.filter((b) => !b.paid && b.diff >= 0 && b.diff <= 14).map((b) => b.amount)),
    overdue: rows.filter((b) => b.overdue),
    next: rows.find((b) => !b.paid && b.diff >= 0) ?? null,
  };
}

export function relativeDue(b: BillRow): string {
  if (b.paid) return "Paid";
  if (b.diff < 0) return `${-b.diff} day${b.diff === -1 ? "" : "s"} overdue`;
  if (b.diff === 0) return "Today";
  if (b.diff === 1) return "Tomorrow";
  return `in ${b.diff} days`;
}

/* ───────────────────────────── income ───────────────────────────── */

export function incomeBySourceForMonth(d: DashboardData) {
  return INCOME_SOURCES.map((src) => ({
    source: src,
    amount: sum(d.income.filter((i) => i.source === src).map((i) => i.amount)),
  }));
}
