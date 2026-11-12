"use server";

import { and, eq, sql } from "drizzle-orm";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { CUSTOM_COLORS, CUSTOM_ICONS, INCOME_SOURCES, RECURRENCES } from "@/lib/constants";
import { addMonthsToDate, diffDays, ISO_DATE, parseISO, daysInMonth, todayISO } from "@/lib/dates";
import { MAX_PAISE } from "@/lib/money";
import { requireUserId, UnauthorizedError } from "./session";
import { makeUndoToken, readUndoToken, runUndo, UndoRejected, type UndoStep } from "./undo";

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

/** `undo` is a short-lived token for `undo()`; every write that changed something returns one. */
export type ActionResult<T = undefined> = { ok: true; data: T; undo?: string } | { ok: false; error: string };

/** Handed to each action so it can say how to reverse what it just did. */
type Ctx = { undo: (...steps: UndoStep[]) => void };

class UserError extends Error {}

/**
 * Wraps every action: authenticates, validates input with zod, and turns
 * failures into safe messages (no stack traces or SQL reach the browser).
 */
function action<S extends z.ZodType, T>(input: S, fn: (userId: string, data: z.output<S>, ctx: Ctx) => Promise<T>) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    try {
      const userId = await requireUserId();
      const parsed = input.safeParse(raw);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
      const steps: UndoStep[] = [];
      const data = await fn(userId, parsed.data, { undo: (...s) => void steps.unshift(...s) });
      return steps.length ? { ok: true, data, undo: makeUndoToken(userId, steps) } : { ok: true, data };
    } catch (err) {
      unstable_rethrow(err);
      if (err instanceof UnauthorizedError) return { ok: false, error: "Your session expired. Sign in again." };
      if (err instanceof UserError || err instanceof UndoRejected) return { ok: false, error: err.message };
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

const _addSpend = action(spendInput, async (userId, d, ctx) => {
  const [row] = await db
    .insert(txn)
    .values({ userId, categoryId: d.categoryId, amount: d.amount, note: d.note, occurredOn: d.date })
    .returning({ id: txn.id });
  ctx.undo({ op: "del", table: "txn", ids: [row.id] });
  return row.id;
});
export async function addSpend(input: z.input<typeof spendInput>) {
  return _addSpend(input);
}

const updateSpendInput = spendInput.extend({ id });
const _updateSpend = action(updateSpendInput, async (userId, d, ctx) => {
  await db.transaction(async (tx) => {
    const prev = assertFound(
      await tx
        .select({ categoryId: txn.categoryId, amount: txn.amount, note: txn.note, occurredOn: txn.occurredOn })
        .from(txn)
        .where(and(eq(txn.id, d.id), eq(txn.userId, userId)))
        .for("update"),
      "transaction",
    );
    await tx
      .update(txn)
      .set({ categoryId: d.categoryId, amount: d.amount, note: d.note, occurredOn: d.date })
      .where(and(eq(txn.id, d.id), eq(txn.userId, userId)));
    ctx.undo({ op: "upd", table: "txn", id: d.id, set: prev });
  });
});
export async function updateSpend(input: z.input<typeof updateSpendInput>) {
  return _updateSpend(input);
}

const _deleteSpend = action(z.object({ id }), async (userId, d, ctx) => {
  const row = assertFound(
    await db
      .delete(txn)
      .where(and(eq(txn.id, d.id), eq(txn.userId, userId)))
      .returning(),
    "transaction",
  );
  // Undo puts back the exact row, bill link included.
  ctx.undo({ op: "ins", table: "txn", rows: [row] });
  return { billId: row.billId };
});
export async function deleteSpend(input: { id: string }) {
  return _deleteSpend(input);
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
const _addIncome = action(incomeInput, async (userId, d, ctx) => {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(income)
      .values({ userId, source: d.source, amount: d.amount, note: d.note, receivedOn: d.date })
      .returning({ id: income.id });
    ctx.undo({ op: "del", table: "income", ids: [row.id] });
    if (!d.loan) return;
    // One reminder series, one "Once" occurrence per instalment: they're paid in order like any series,
    // and nothing repeats after the last one.
    const { instalment, count, firstDue } = d.loan;
    const base = (d.loan.name || d.note || "Loan").slice(0, 60);
    const seriesId = crypto.randomUUID();
    const categoryId = await billsCategoryId(userId, tx);
    const bills = await tx
      .insert(bill)
      .values(
      Array.from({ length: count }, (_, i) => ({
        userId,
        seriesId,
        name: count === 1 ? `${base} repayment` : `${base} repayment ${i + 1}/${count}`,
        amount: instalment,
        dueOn: addMonthsToDate(firstDue, i),
        recurrence: "Once" as const,
        categoryId,
      })),
      )
      .returning({ id: bill.id });
    ctx.undo({ op: "del", table: "bill", ids: bills.map((b) => b.id) });
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
const _createGoal = action(goalInput, async (userId, d, ctx) => {
  // A goal can't be deleted, except by undoing its creation within the undo window.
  const [row] = await db
    .insert(goal)
    .values({ userId, name: d.name, target: d.target, monthly: d.monthly })
    .returning({ id: goal.id });
  ctx.undo({ op: "del", table: "goal", ids: [row.id] });
});
export async function createGoal(input: z.input<typeof goalInput>) {
  return _createGoal(input);
}

const contributeInput = z.object({ goalId: id, amount: paise, note, date: isoDate });
const _contributeToGoal = action(contributeInput, async (userId, d, ctx) => {
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
    const [row] = await tx
      .insert(goalContribution)
      .values({ userId, goalId: d.goalId, amount, note: d.note, contributedOn: d.date })
      .returning({ id: goalContribution.id });
    ctx.undo({ op: "del", table: "goalContribution", ids: [row.id] });
    return { applied: amount, capped: amount < d.amount };
  });
});
export async function contributeToGoal(input: z.input<typeof contributeInput>) {
  return _contributeToGoal(input);
}

/** Goals can't be deleted (a goal is a goal); pausing takes one out of safe-to-spend until resumed. */
const pauseInput = z.object({ goalId: id, paused: z.boolean() });
const _setGoalPaused = action(pauseInput, async (userId, d, ctx) => {
  await db.transaction(async (tx) => {
    const prev = assertFound(
      await tx
        .select({ pausedAt: goal.pausedAt })
        .from(goal)
        .where(and(eq(goal.id, d.goalId), eq(goal.userId, userId)))
        .for("update"),
      "goal",
    );
    await tx
      .update(goal)
      .set({ pausedAt: d.paused ? (prev.pausedAt ?? sql`now()`) : null })
      .where(and(eq(goal.id, d.goalId), eq(goal.userId, userId)));
    ctx.undo({ op: "upd", table: "goal", id: d.goalId, set: prev });
  });
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
const _addBill = action(billInput, async (userId, d, ctx) => {
  const categoryId = d.categoryId ?? (await billsCategoryId(userId));
  const [row] = await db
    .insert(bill)
    .values({
      userId,
      name: d.name,
      amount: d.amount,
      dueOn: d.dueOn,
      recurrence: d.recurrence,
      categoryId,
    })
    .returning({ id: bill.id });
  ctx.undo({ op: "del", table: "bill", ids: [row.id] });
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

const _setBillPaid = action(z.object({ billId: id, paid: z.boolean() }), async (userId, d, ctx) => {
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
      const spends = await tx
        .delete(txn)
        .where(and(eq(txn.billId, b.id), eq(txn.userId, userId)))
        .returning();
      // Drop the next occurrence that paying created, as long as nothing has been paid against it.
      const next =
        b.recurrence === "Once"
          ? []
          : await tx
              .delete(bill)
              .where(
                and(
                  eq(bill.userId, userId),
                  eq(bill.seriesId, b.seriesId),
                  eq(bill.dueOn, nextDue),
                  sql`not exists (select 1 from "transaction" t where t.bill_id = ${bill.id})`,
                ),
              )
              .returning();
      // Undo puts both back exactly: the next occurrence, then the spend (same id, date and bill link).
      ctx.undo({ op: "ins", table: "bill", rows: next }, { op: "ins", table: "txn", rows: spends });
      return;
    }
    // Occurrences are paid in order: an earlier unpaid one has to be ticked first.
    const earlier = await tx.execute(sql`
      select 1 from bill eb where eb.user_id = ${userId} and eb.series_id = ${b.seriesId} and eb.due_on < ${b.dueOn}
        and not exists (select 1 from "transaction" t where t.bill_id = eb.id) limit 1`);
    if (earlier.rows.length) throw new UserError(`Pay the earlier ${b.name} first.`);
    // Unique index on transaction.bill_id makes double-paying impossible.
    const spend = await tx
      .insert(txn)
      .values({ userId, categoryId: b.categoryId, amount: b.amount, note: b.name, occurredOn: todayISO(), billId: b.id })
      .onConflictDoNothing()
      .returning({ id: txn.id });
    let next: { id: string }[] = [];
    if (b.recurrence !== "Once") {
      next = await tx
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
        .onConflictDoNothing()
        .returning({ id: bill.id });
    }
    // Undo removes only what this call created (the spend, then the next occurrence).
    ctx.undo(
      { op: "del", table: "txn", ids: spend.map((r) => r.id) },
      { op: "del", table: "bill", ids: next.map((r) => r.id) },
    );
  });
});
export async function setBillPaid(input: { billId: string; paid: boolean }) {
  return _setBillPaid(input);
}

const billEditInput = billInput.extend({ billId: id, categoryId: id });
/** Edits an unpaid occurrence; later occurrences copy it when they're created. */
const _updateBill = action(billEditInput, async (userId, d, ctx) => {
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
    ctx.undo({
      op: "upd",
      table: "bill",
      id: b.id,
      set: { name: b.name, amount: b.amount, dueOn: b.dueOn, recurrence: b.recurrence, categoryId: b.categoryId },
    });
  });
});
export async function updateBill(input: z.input<typeof billEditInput>) {
  return _updateBill(input);
}

/** Stops a reminder: removes this and any later unpaid occurrences. Paid ones stay as history. */
const _deleteBill = action(z.object({ billId: id }), async (userId, d, ctx) => {
  return db.transaction(async (tx) => {
    const b = assertFound(
      await tx.select().from(bill).where(and(eq(bill.id, d.billId), eq(bill.userId, userId))).for("update"),
      "reminder",
    );
    const gone = await tx
      .delete(bill)
      .where(
        and(
          eq(bill.userId, userId),
          eq(bill.seriesId, b.seriesId),
          sql`${bill.dueOn} >= ${b.dueOn}`,
          sql`not exists (select 1 from "transaction" t where t.bill_id = ${bill.id})`,
        ),
      )
      .returning();
    if (!gone.length) throw new UserError("Paid reminders can't be deleted. Mark it unpaid first.");
    ctx.undo({ op: "ins", table: "bill", rows: gone });
    return gone.length;
  });
});
export async function deleteBill(input: { billId: string }) {
  return _deleteBill(input);
}

/* ───────────────────────────── budgets & categories ───────────────────────────── */

const budgetInput = z.object({ key: z.enum(["monthly", "daily", "hard"]), amount: paiseOrZero });
const _updateBudget = action(budgetInput, async (userId, d, ctx) => {
  const col = ({ monthly: "monthlyBudget", daily: "dailyBudget", hard: "hardLimit" } as const)[d.key];
  await db.transaction(async (tx) => {
    const [prev] = await tx
      .select({ v: settings[col] })
      .from(settings)
      .where(eq(settings.userId, userId))
      .for("update");
    await tx
      .update(settings)
      .set({ [col]: d.amount })
      .where(eq(settings.userId, userId));
    if (prev) ctx.undo({ op: "settings", set: { [col]: prev.v } });
  });
});
export async function updateBudget(input: z.input<typeof budgetInput>) {
  return _updateBudget(input);
}

const catBudgetInput = z.object({ categoryId: id, amount: paiseOrZero });
const _updateCategoryBudget = action(catBudgetInput, async (userId, d, ctx) => {
  await db.transaction(async (tx) => {
    const prev = assertFound(
      await tx
        .select({ budget: category.budget })
        .from(category)
        .where(and(eq(category.id, d.categoryId), eq(category.userId, userId)))
        .for("update"),
      "category",
    );
    await tx
      .update(category)
      .set({ budget: d.amount })
      .where(and(eq(category.id, d.categoryId), eq(category.userId, userId)));
    ctx.undo({ op: "upd", table: "category", id: d.categoryId, set: prev });
  });
});
export async function updateCategoryBudget(input: z.input<typeof catBudgetInput>) {
  return _updateCategoryBudget(input);
}

const categoryInput = z.object({
  name: z.string().trim().min(1, "Name the category").max(40),
  icon: z.enum(CUSTOM_ICONS),
  color: z.enum(CUSTOM_COLORS),
});
const _createCategory = action(categoryInput, async (userId, d, ctx) => {
  const [row] = await db
    .insert(category)
    .values({ userId, name: d.name, icon: d.icon, color: d.color, budget: 0 })
    .returning({ id: category.id });
  ctx.undo({ op: "del", table: "category", ids: [row.id] });
  return row.id;
});
export async function createCategory(input: z.input<typeof categoryInput>) {
  return _createCategory(input);
}

/** "My balance is actually ₹X" — stores the difference as an adjustment. */
const balanceInput = z.object({ amount: z.number().int().min(-MAX_PAISE).max(MAX_PAISE) });
const _setBalance = action(balanceInput, async (userId, d, ctx) => {
  const today = todayISO();
  const [prev] = await db
    .select({ balanceAdjustment: settings.balanceAdjustment, balanceSetAt: settings.balanceSetAt })
    .from(settings)
    .where(eq(settings.userId, userId));
  if (prev) ctx.undo({ op: "settings", set: prev });
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

/* ───────────────────────────── undo ───────────────────────────── */

/** Reverses a write using the token it returned. Works for UNDO_WINDOW_MS (5 s); after that the change is permanent. */
const _undo = action(z.object({ token: z.string().min(1).max(500_000) }), async (userId, d) => {
  const steps = readUndoToken(d.token, userId);
  try {
    await db.transaction((tx) => runUndo(tx, userId, steps));
  } catch (err) {
    const code = (err as { cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
    // e.g. undoing a new category that a spend already uses.
    if (code === "23503") throw new UserError("Can't undo: something now depends on it.");
    throw err;
  }
});
export async function undo(input: { token: string }) {
  return _undo(input);
}
