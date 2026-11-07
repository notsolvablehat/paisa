import "server-only";
import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { INCOME_SOURCES, type IncomeSource } from "@/lib/constants";
import { addMonths, addDays, monthRange, parseISO } from "@/lib/dates";
import type { DashboardData, Income, LedgerData, LedgerRow, RemindersData } from "@/lib/types";
import { provisionNewUser } from "./provision";

const { settings, category, transaction: txn, income, goal, goalContribution, bill } = schema;

/** SUM() of a bigint column comes back as numeric → cast and map to a JS number. */
const sumPaise = (col: typeof txn.amount | typeof income.amount | typeof goalContribution.amount) =>
  sql<number>`coalesce(sum(${col}), 0)::bigint`.mapWith(Number);

/**
 * Loads everything the dashboard needs for one month. Every query is scoped
 * by `userId`, which must come from the verified session — never from input.
 */
export async function getDashboard(userId: string, month: string, today: string): Promise<DashboardData> {
  const { start, end } = monthRange(month);
  const histStart = monthRange(addMonths(month, -11)).start;
  const { y } = parseISO(month);
  const yearsStart = `${y - 2}-01-01`;
  const srcStart = monthRange(addMonths(month, -5)).start;

  let [s] = await db.select().from(settings).where(eq(settings.userId, userId));
  if (!s) {
    await provisionNewUser(userId);
    [s] = await db.select().from(settings).where(eq(settings.userId, userId));
  }

  const [
    categories,
    transactions,
    monthIncome,
    recentIncome,
    goals,
    bills,
    [incTotal],
    [spendTotal],
    monthHist,
    incomeHist,
    yearSpend,
    yearIncome,
    srcHist,
  ] = await Promise.all([
    db
      .select({ id: category.id, name: category.name, icon: category.icon, color: category.color, budget: category.budget })
      .from(category)
      .where(eq(category.userId, userId))
      .orderBy(asc(category.createdAt), asc(category.name)),
    db
      .select({
        id: txn.id,
        categoryId: txn.categoryId,
        amount: txn.amount,
        note: txn.note,
        date: txn.occurredOn,
        billId: txn.billId,
      })
      .from(txn)
      .where(and(eq(txn.userId, userId), gte(txn.occurredOn, start), lte(txn.occurredOn, end)))
      .orderBy(desc(txn.occurredOn), desc(txn.createdAt)),
    db
      .select({ id: income.id, source: income.source, amount: income.amount, note: income.note, date: income.receivedOn })
      .from(income)
      .where(and(eq(income.userId, userId), gte(income.receivedOn, start), lte(income.receivedOn, end)))
      .orderBy(desc(income.receivedOn), desc(income.createdAt)),
    db
      .select({ id: income.id, source: income.source, amount: income.amount, note: income.note, date: income.receivedOn })
      .from(income)
      .where(and(eq(income.userId, userId), lte(income.receivedOn, end)))
      .orderBy(desc(income.receivedOn), desc(income.createdAt))
      .limit(5),
    db
      .select({
        id: goal.id,
        name: goal.name,
        target: goal.target,
        monthly: goal.monthly,
        assigned: sumPaise(goalContribution.amount),
        contributedInMonth: sql<number>`coalesce(sum(${goalContribution.amount}) filter (where ${goalContribution.contributedOn} between ${start} and ${end}), 0)::bigint`.mapWith(
          Number,
        ),
      })
      .from(goal)
      .leftJoin(goalContribution, eq(goalContribution.goalId, goal.id))
      .where(eq(goal.userId, userId))
      .groupBy(goal.id)
      .orderBy(asc(goal.createdAt)),
    db
      .select({
        id: bill.id,
        name: bill.name,
        amount: bill.amount,
        dueOn: bill.dueOn,
        recurrence: bill.recurrence,
        categoryId: bill.categoryId,
        paid: sql<boolean>`${txn.id} is not null`,
      })
      .from(bill)
      .leftJoin(txn, eq(txn.billId, bill.id))
      .where(
        and(
          eq(bill.userId, userId),
          or(
            // Unpaid: the earliest open occurrence of each series (overdue or within ~3 months).
            and(
              isNull(txn.id),
              lte(bill.dueOn, addDays(end, 90)),
              sql`not exists (
                select 1 from bill eb where eb.user_id = ${bill.userId} and eb.series_id = ${bill.seriesId}
                  and eb.due_on < ${bill.dueOn} and not exists (select 1 from "transaction" t where t.bill_id = eb.id))`,
            ),
            // Paid: only what belongs to the viewed month.
            and(gte(bill.dueOn, start), lte(bill.dueOn, end)),
          ),
        ),
      )
      .orderBy(asc(bill.dueOn), asc(bill.name)),
    db
      .select({ v: sumPaise(income.amount), n: sql<number>`count(*)::int`.mapWith(Number) })
      .from(income)
      .where(and(eq(income.userId, userId), lte(income.receivedOn, today))),
    db
      .select({ v: sumPaise(txn.amount), n: sql<number>`count(*)::int`.mapWith(Number) })
      .from(txn)
      .where(and(eq(txn.userId, userId), lte(txn.occurredOn, today))),
    db
      .select({ month: sql<string>`to_char(${txn.occurredOn}, 'YYYY-MM')`, v: sumPaise(txn.amount) })
      .from(txn)
      .where(and(eq(txn.userId, userId), gte(txn.occurredOn, histStart), lte(txn.occurredOn, end)))
      .groupBy(sql`1`),
    db
      .select({ month: sql<string>`to_char(${income.receivedOn}, 'YYYY-MM')`, v: sumPaise(income.amount) })
      .from(income)
      .where(and(eq(income.userId, userId), gte(income.receivedOn, histStart), lte(income.receivedOn, end)))
      .groupBy(sql`1`),
    db
      .select({ year: sql<number>`extract(year from ${txn.occurredOn})::int`, v: sumPaise(txn.amount) })
      .from(txn)
      .where(and(eq(txn.userId, userId), gte(txn.occurredOn, yearsStart), lte(txn.occurredOn, end)))
      .groupBy(sql`1`),
    db
      .select({ year: sql<number>`extract(year from ${income.receivedOn})::int`, v: sumPaise(income.amount) })
      .from(income)
      .where(and(eq(income.userId, userId), gte(income.receivedOn, yearsStart), lte(income.receivedOn, end)))
      .groupBy(sql`1`),
    db
      .select({
        month: sql<string>`to_char(${income.receivedOn}, 'YYYY-MM')`,
        source: income.source,
        v: sumPaise(income.amount),
      })
      .from(income)
      .where(and(eq(income.userId, userId), gte(income.receivedOn, srcStart), lte(income.receivedOn, end)))
      .groupBy(sql`1`, income.source),
  ]);

  const spendByMonth = new Map(monthHist.map((r) => [r.month, r.v]));
  const incByMonth = new Map(incomeHist.map((r) => [r.month, r.v]));
  const spendByYear = new Map(yearSpend.map((r) => [r.year, r.v]));
  const incByYear = new Map(yearIncome.map((r) => [r.year, r.v]));

  const emptySources = () => Object.fromEntries(INCOME_SOURCES.map((k) => [k, 0])) as Record<IncomeSource, number>;
  const bySrc = new Map<string, Record<IncomeSource, number>>();
  for (const r of srcHist) {
    const rec = bySrc.get(r.month) ?? emptySources();
    rec[r.source] = r.v;
    bySrc.set(r.month, rec);
  }

  return {
    today,
    month,
    settings: { monthlyBudget: s.monthlyBudget, dailyBudget: s.dailyBudget, hardLimit: s.hardLimit },
    balance: s.balanceAdjustment + incTotal.v - spendTotal.v,
    balanceKnown: s.balanceSetAt != null || incTotal.n > 0 || spendTotal.n > 0,
    categories,
    transactions,
    income: monthIncome as Income[],
    recentIncome: recentIncome as Income[],
    goals,
    bills: bills.map((b) => ({ ...b, paid: Boolean(b.paid) })),
    history: {
      months: Array.from({ length: 12 }, (_, i) => {
        const m = addMonths(month, i - 11);
        return { month: m, spent: spendByMonth.get(m) ?? 0, income: incByMonth.get(m) ?? 0 };
      }),
      years: [y - 2, y - 1, y].map((yr) => ({ year: yr, spent: spendByYear.get(yr) ?? 0, income: incByYear.get(yr) ?? 0 })),
      incomeBySource: Array.from({ length: 6 }, (_, i) => {
        const m = addMonths(month, i - 5);
        return { month: m, bySource: bySrc.get(m) ?? emptySources() };
      }),
    },
  };
}

/** Hard cap on one ledger request; the UI narrows the date range beyond this. */
export const LEDGER_LIMIT = 5000;

/** Spends and income between two dates (inclusive), newest first, for the Transactions page. */
export async function getLedger(userId: string, from: string, to: string): Promise<LedgerData> {
  const [spends, incomes] = await Promise.all([
    db
      .select({ id: txn.id, amount: txn.amount, note: txn.note, date: txn.occurredOn, categoryId: txn.categoryId, billId: txn.billId })
      .from(txn)
      .where(and(eq(txn.userId, userId), gte(txn.occurredOn, from), lte(txn.occurredOn, to)))
      .orderBy(desc(txn.occurredOn), desc(txn.createdAt))
      .limit(LEDGER_LIMIT + 1),
    db
      .select({ id: income.id, amount: income.amount, note: income.note, date: income.receivedOn, source: income.source })
      .from(income)
      .where(and(eq(income.userId, userId), gte(income.receivedOn, from), lte(income.receivedOn, to)))
      .orderBy(desc(income.receivedOn), desc(income.createdAt))
      .limit(LEDGER_LIMIT + 1),
  ]);
  const rows: LedgerRow[] = [
    ...spends.map((s) => ({ ...s, kind: "spend" as const, source: null })),
    ...incomes.map((i) => ({ ...i, kind: "income" as const, categoryId: null, billId: null })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const truncated = rows.length > LEDGER_LIMIT;
  return { from, to, truncated, rows: rows.slice(0, LEDGER_LIMIT) };
}

/** Reminders due in [from, to], plus anything still unpaid from before `from` (it's overdue and actionable). */
export async function getReminders(userId: string, from: string, to: string): Promise<RemindersData> {
  const rows = await db
    .select({
      id: bill.id,
      seriesId: bill.seriesId,
      name: bill.name,
      amount: bill.amount,
      dueOn: bill.dueOn,
      recurrence: bill.recurrence,
      categoryId: bill.categoryId,
      paidOn: txn.occurredOn,
    })
    .from(bill)
    .leftJoin(txn, eq(txn.billId, bill.id))
    .where(
      and(
        eq(bill.userId, userId),
        or(and(gte(bill.dueOn, from), lte(bill.dueOn, to)), and(isNull(txn.id), sql`${bill.dueOn} < ${from}`)),
      ),
    )
    .orderBy(asc(bill.dueOn), asc(bill.name))
    .limit(LEDGER_LIMIT);
  return { from, to, rows };
}
