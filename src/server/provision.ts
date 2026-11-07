import "server-only";
import { db, schema } from "@/db";
import { DEFAULT_CATEGORIES } from "@/lib/constants";

/**
 * Give a brand-new account its settings row and default categories. Idempotent.
 * Budgets start at zero: the user sets their own (the demo seed uses DEFAULT_BUDGETS).
 */
export async function provisionNewUser(userId: string) {
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.settings)
      .values({ userId })
      .onConflictDoNothing();
    await tx
      .insert(schema.category)
      .values(DEFAULT_CATEGORIES.map((c) => ({ userId, name: c.name, icon: c.icon, color: c.color, budget: 0 })))
      .onConflictDoNothing();
  });
}
