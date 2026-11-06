import "server-only";
import { db, schema } from "@/db";
import { DEFAULT_BUDGETS, DEFAULT_CATEGORIES } from "@/lib/constants";
import { rupeesToPaise } from "@/lib/money";

/** Give a brand-new account its default budgets and categories. Idempotent. */
export async function provisionNewUser(userId: string) {
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.settings)
      .values({
        userId,
        monthlyBudget: rupeesToPaise(DEFAULT_BUDGETS.monthly),
        dailyBudget: rupeesToPaise(DEFAULT_BUDGETS.daily),
        hardLimit: rupeesToPaise(DEFAULT_BUDGETS.hard),
      })
      .onConflictDoNothing();
    await tx
      .insert(schema.category)
      .values(DEFAULT_CATEGORIES.map((c) => ({ userId, name: c.name, icon: c.icon, color: c.color, budget: rupeesToPaise(c.budget) })))
      .onConflictDoNothing();
  });
}
