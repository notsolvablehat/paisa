"use server";

import { and, eq, sql } from "drizzle-orm";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { CUSTOM_COLORS, CUSTOM_ICONS, INCOME_SOURCES, RECURRENCES } from "@/lib/constants";
import { addMonthsToDate, diffDays, ISO_DATE, parseISO, daysInMonth, todayISO } from "@/lib/dates";
import { MAX_PAISE } from "@/lib/money";
import { requireUserId, UnauthorizedError } from "./session";

const { settings, category, transaction: txn, income, goal, goalContribution, bill } = schema;

/* ───────────────────────────── validation ───────────────────────────── */

/** Amounts arrive in paise (integer minor units), exactly as stored. */
const paise = z.number().int().min(1, "Enter an amount").max(MAX_PAISE, "That amount is too large");
const paiseOrZero = z.number().int().min(0).max(MAX_PAISE, "That amount is too large");
const id = z.uuid();
const note = z.string().trim().max(120, "Keep the note under 120 characters").default("");
const isoDate = z
  .string()
  .regex(ISO_DATE, "Invalid date")
  .refine((s) => {
    const { y, m, d } = parseISO(s);
    return d <= daysInMonth(y, m);
  }, "Invalid date")
  .refine((s) => Math.abs(diffDays(todayISO(), s)) <= 3660, "Date must be within 10 years of today");

/* ───────────────────────────── plumbing ───────────────────────────── */

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

class UserError extends Error {}

/**
 * Wraps every action: authenticates, validates input with zod, and turns
 * failures into safe messages (no stack traces or SQL reach the browser).
 */
function action<S extends z.ZodType, T>(input: S, fn: (userId: string, data: z.output<S>) => Promise<T>) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    try {
      const userId = await requireUserId();
      const parsed = input.safeParse(raw);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
      return { ok: true, data: await fn(userId, parsed.data) };
    } catch (err) {
      unstable_rethrow(err);
      if (err instanceof UnauthorizedError) return { ok: false, error: "Your session expired. Sign in again." };
      if (err instanceof UserError) return { ok: false, error: err.message };
      const code = (err as { cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
      if (code === "23505") return { ok: false, error: "That already exists." };
      if (code === "23503") return { ok: false, error: "That item no longer exists. Refresh and try again." };
      console.error("Server action failed", err);
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  };
}

function assertFound<T>(rows: T[], what = "item"): T {
  if (rows.length === 0) throw new UserError(`That ${what} was not found.`);
  return rows[0];
}

/* ───────────────────────────── spends ───────────────────────────── */

const spendInput = z.object({ amount: paise, categoryId: id, note, date: isoDate });

const _addSpend = action(spendInput, async (userId, d) => {
  const [row] = await db
    .insert(txn)
    .values({ userId, categoryId: d.categoryId, amount: d.amount, note: d.note, occurredOn: d.date })
    .returning({ id: txn.id });
  return row.id;
});
export async function addSpend(input: z.input<typeof spendInput>) {
  return _addSpend(input);
}

const updateSpendInput = spendInput.extend({ id });
const _updateSpend = action(updateSpendInput, async (userId, d) => {
  const rows = await db
    .update(txn)
    .set({ categoryId: d.categoryId, amount: d.amount, note: d.note, occurredOn: d.date })
    .where(and(eq(txn.id, d.id), eq(txn.userId, userId)))
    .returning({ id: txn.id });
  assertFound(rows, "transaction");
});
export async function updateSpend(input: z.input<typeof updateSpendInput>) {
  return _updateSpend(input);
}

const _deleteSpend = action(z.object({ id }), async (userId, d) => {
  const rows = await db
    .delete(txn)
    .where(and(eq(txn.id, d.id), eq(txn.userId, userId)))
    .returning({
      id: txn.id,
      categoryId: txn.categoryId,
      amount: txn.amount,
      note: txn.note,
      date: txn.occurredOn,
      billId: txn.billId,
    });
  return assertFound(rows, "transaction");
});
export async function deleteSpend(input: { id: string }) {
  return _deleteSpend(input);
}

/** Undo for deleteSpend: re-inserts the same row (amount here is in paise). */
const restoreInput = z.object({
  id,
  categoryId: id,
  amount: paise,
  note,
  date: isoDate,
  billId: id.nullable(),
});
const _restoreSpend = action(restoreInput, async (userId, d) => {
  await db
    .insert(txn)
    .values({ id: d.id, userId, categoryId: d.categoryId, amount: d.amount, note: d.note, occurredOn: d.date, billId: d.billId })
    .onConflictDoNothing();
});
export async function restoreSpend(input: z.input<typeof restoreInput>) {
  return _restoreSpend(input);
}

/* ───────────────────────────── income ───────────────────────────── */

/** Repayment plan for a loan: `count` monthly instalments of `instalment`, the first due on `firstDue`. */
const loanInput = z.object({
  instalment: paise,
  count: z.number().int().min(1, "At least one instalment").max(60, "At most 60 instalments"),
  firstDue: isoDate,
  name: z.string().trim().max(80).default(""),
});
const incomeInput = z
  .object({ amount: paise, source: z.enum(INCOME_SOURCES), note, date: isoDate, loan: loanInput.optional() })
  .refine((d) => (d.source === "Loan") === Boolean(d.loan), { message: "Add the repayment details for this loan" })
  .refine((d) => !d.loan || d.loan.firstDue >= d.date, { message: "The first repayment can't be before the loan" });
const _addIncome = action(incomeInput, async (userId, d) => {
  await db.transaction(async (tx) => {
    await tx.insert(income).values({ userId, source: d.source, amount: d.amount, note: d.note, receivedOn: d.date });
    if (!d.loan) return;
    // One reminder series, one "Once" occurrence per instalment: they're paid in order like any series,
    // and nothing repeats after the last one.
    const { instalment, count, firstDue } = d.loan;
    const base = (d.loan.name || d.note || "Loan").slice(0, 60);
    const seriesId = crypto.randomUUID();
    const categoryId = await billsCategoryId(userId, tx);
    await tx.insert(bill).values(
      Array.from({ length: count }, (_, i) => ({
        userId,
        seriesId,
        name: count === 1 ? `${base} repayment` : `${base} repayment ${i + 1}/${count}`,
        amount: instalment,
        dueOn: addMonthsToDate(firstDue, i),
        recurrence: "Once" as const,
        categoryId,
      })),
    );
  });
});
export async function addIncome(input: z.input<typeof incomeInput>) {
  return _addIncome(input);
}

/* ───────────────────────────── goals ───────────────────────────── */

const goalInput = z
  .object({
    name: z.string().trim().min(1, "Give the goal a name").max(80),
    target: paise,
    monthly: paise,
  })
  .refine((g) => g.monthly <= g.target, { message: "Monthly amount can't be more than the target" });
const _createGoal = action(goalInput, async (userId, d) => {
  await db.insert(goal).values({ userId, name: d.name, target: d.target, monthly: d.monthly });
});
export async function createGoal(input: z.input<typeof goalInput>) {
  return _createGoal(input);
}

const contributeInput = z.object({ goalId: id, amount: paise, note, date: isoDate });
const _contributeToGoal = action(contributeInput, async (userId, d) => {
  return db.transaction(async (tx) => {
    // Lock the goal so two concurrent contributions can't overshoot the target.
    const g = assertFound(
      await tx
        .select({ target: goal.target, pausedAt: goal.pausedAt })
        .from(goal)
        .where(and(eq(goal.id, d.goalId), eq(goal.userId, userId)))
        .for("update"),
      "goal",
    );
    if (g.pausedAt) throw new UserError("This goal is paused. Resume it to assign money.");
    const [{ assigned }] = await tx
      .select({ assigned: sql<number>`coalesce(sum(${goalContribution.amount}), 0)::bigint`.mapWith(Number) })
      .from(goalContribution)
      .where(eq(goalContribution.goalId, d.goalId));
    const remaining = g.target - assigned;
    if (remaining <= 0) throw new UserError("This goal is already fully funded.");
    const amount = Math.min(d.amount, remaining);
    await tx.insert(goalContribution).values({ userId, goalId: d.goalId, amount, note: d.note, contributedOn: d.date });
    return { applied: amount, capped: amount < d.amount };
  });
});
export async function contributeToGoal(input: z.input<typeof contributeInput>) {
  return _contributeToGoal(input);
}

/** Goals can't be deleted (a goal is a goal); pausing takes one out of safe-to-spend until resumed. */
const pauseInput = z.object({ goalId: id, paused: z.boolean() });
const _setGoalPaused = action(pauseInput, async (userId, d) => {
  assertFound(
    await db
      .update(goal)
      .set({ pausedAt: d.paused ? sql`now()` : null })
      .where(and(eq(goal.id, d.goalId), eq(goal.userId, userId)))
      .returning({ id: goal.id }),
    "goal",
  );
});
export async function setGoalPaused(input: z.input<typeof pauseInput>) {
  return _setGoalPaused(input);
}

/* ───────────────────────────── bills ───────────────────────────── */

const billInput = z.object({
  name: z.string().trim().min(1, "What is the bill for?").max(80),
  amount: paise,
  dueOn: isoDate,
  recurrence: z.enum(RECURRENCES),
  categoryId: id.optional(),
});
const _addBill = action(billInput, async (userId, d) => {
  const categoryId = d.categoryId ?? (await billsCategoryId(userId));
  await db.insert(bill).values({
    userId,
    name: d.name,
    amount: d.amount,
    dueOn: d.dueOn,
    recurrence: d.recurrence,
    categoryId,
  });
});
export async function addBill(input: z.input<typeof billInput>) {
  return _addBill(input);
}

/** Reminders made without a category go under the user's "Bills" category. */
async function billsCategoryId(userId: string, q: Pick<typeof db, "select"> = db): Promise<string> {
  const [c] = await q
    .select({ id: category.id })
    .from(category)
    .where(and(eq(category.userId, userId), sql`lower(${category.name}) = 'bills'`));
  if (!c) throw new UserError("Create a “Bills” category first.");
  return c.id;
}

const _setBillPaid = action(z.object({ billId: id, paid: z.boolean() }), async (userId, d) => {
  await db.transaction(async (tx) => {
    const b = assertFound(
      await tx
        .select()
        .from(bill)
        .where(and(eq(bill.id, d.billId), eq(bill.userId, userId)))
        .for("update"),
      "bill",
    );
    const nextDue = addMonthsToDate(b.dueOn, b.recurrence === "Yearly" ? 12 : 1);
    if (!d.paid) {
      await tx.delete(txn).where(and(eq(txn.billId, b.id), eq(txn.userId, userId)));
      // Drop the next occurrence that paying created, as long as nothing has been paid against it.
      if (b.recurrence !== "Once") {
        await tx.execute(sql`
          delete from bill nb where nb.user_id = ${userId} and nb.series_id = ${b.seriesId} and nb.due_on = ${nextDue}
            and not exists (select 1 from "transaction" t where t.bill_id = nb.id)`);
      }
      return;
    }
    // Occurrences are paid in order: an earlier unpaid one has to be ticked first.
    const earlier = await tx.execute(sql`
      select 1 from bill eb where eb.user_id = ${userId} and eb.series_id = ${b.seriesId} and eb.due_on < ${b.dueOn}
        and not exists (select 1 from "transaction" t where t.bill_id = eb.id) limit 1`);
    if (earlier.rows.length) throw new UserError(`Pay the earlier ${b.name} first.`);
    // Unique index on transaction.bill_id makes double-paying impossible.
    await tx
      .insert(txn)
      .values({ userId, categoryId: b.categoryId, amount: b.amount, note: b.name, occurredOn: todayISO(), billId: b.id })
      .onConflictDoNothing();
    if (b.recurrence !== "Once") {
      await tx
        .insert(bill)
        .values({
          userId,
          seriesId: b.seriesId,
          name: b.name,
          amount: b.amount,
          recurrence: b.recurrence,
          categoryId: b.categoryId,
          dueOn: nextDue,
        })
        .onConflictDoNothing();
    }
  });
});
export async function setBillPaid(input: { billId: string; paid: boolean }) {
  return _setBillPaid(input);
}

const billEditInput = billInput.extend({ billId: id, categoryId: id });
/** Edits an unpaid occurrence; later occurrences copy it when they're created. */
const _updateBill = action(billEditInput, async (userId, d) => {
  await db.transaction(async (tx) => {
    const b = assertFound(
      await tx.select().from(bill).where(and(eq(bill.id, d.billId), eq(bill.userId, userId))).for("update"),
      "reminder",
    );
    const [paid] = await tx.select({ id: txn.id }).from(txn).where(eq(txn.billId, b.id));
    if (paid) throw new UserError("Mark it unpaid before editing.");
    await tx
      .update(bill)
      .set({ name: d.name, amount: d.amount, dueOn: d.dueOn, recurrence: d.recurrence, categoryId: d.categoryId })
      .where(and(eq(bill.id, b.id), eq(bill.userId, userId)));
  });
});
export async function updateBill(input: z.input<typeof billEditInput>) {
  return _updateBill(input);
}

/** Stops a reminder: removes this and any later unpaid occurrences. Paid ones stay as history. */
const _deleteBill = action(z.object({ billId: id }), async (userId, d) => {
  return db.transaction(async (tx) => {
    const b = assertFound(
      await tx.select().from(bill).where(and(eq(bill.id, d.billId), eq(bill.userId, userId))).for("update"),
      "reminder",
    );
    const res = await tx.execute(sql`
      delete from bill nb where nb.user_id = ${userId} and nb.series_id = ${b.seriesId} and nb.due_on >= ${b.dueOn}
        and not exists (select 1 from "transaction" t where t.bill_id = nb.id)`);
    if (!res.rowCount) throw new UserError("Paid reminders can't be deleted. Mark it unpaid first.");
    return res.rowCount;
  });
});
export async function deleteBill(input: { billId: string }) {
  return _deleteBill(input);
}

/* ───────────────────────────── budgets & categories ───────────────────────────── */

const budgetInput = z.object({ key: z.enum(["monthly", "daily", "hard"]), amount: paiseOrZero });
const _updateBudget = action(budgetInput, async (userId, d) => {
  const col = { monthly: "monthlyBudget", daily: "dailyBudget", hard: "hardLimit" } as const;
  await db
    .update(settings)
    .set({ [col[d.key]]: d.amount })
    .where(eq(settings.userId, userId));
});
export async function updateBudget(input: z.input<typeof budgetInput>) {
  return _updateBudget(input);
}

const catBudgetInput = z.object({ categoryId: id, amount: paiseOrZero });
const _updateCategoryBudget = action(catBudgetInput, async (userId, d) => {
  const rows = await db
    .update(category)
    .set({ budget: d.amount })
    .where(and(eq(category.id, d.categoryId), eq(category.userId, userId)))
    .returning({ id: category.id });
  assertFound(rows, "category");
});
export async function updateCategoryBudget(input: z.input<typeof catBudgetInput>) {
  return _updateCategoryBudget(input);
}

const categoryInput = z.object({
  name: z.string().trim().min(1, "Name the category").max(40),
  icon: z.enum(CUSTOM_ICONS),
  color: z.enum(CUSTOM_COLORS),
});
const _createCategory = action(categoryInput, async (userId, d) => {
  const [row] = await db
    .insert(category)
    .values({ userId, name: d.name, icon: d.icon, color: d.color, budget: 0 })
    .returning({ id: category.id });
  return row.id;
});
export async function createCategory(input: z.input<typeof categoryInput>) {
  return _createCategory(input);
}

/** "My balance is actually ₹X" — stores the difference as an adjustment. */
const balanceInput = z.object({ amount: z.number().int().min(-MAX_PAISE).max(MAX_PAISE) });
const _setBalance = action(balanceInput, async (userId, d) => {
  const today = todayISO();
  await db.execute(sql`
    update ${settings} set balance_adjustment = ${d.amount}
      - coalesce((select sum(${income.amount}) from ${income} where ${income.userId} = ${userId} and ${income.receivedOn} <= ${today}), 0)
      + coalesce((select sum(${txn.amount}) from ${txn} where ${txn.userId} = ${userId} and ${txn.occurredOn} <= ${today}), 0),
      balance_set_at = now(), updated_at = now()
    where ${settings.userId} = ${userId}`);
});
export async function setBalance(input: z.input<typeof balanceInput>) {
  return _setBalance(input);
}
