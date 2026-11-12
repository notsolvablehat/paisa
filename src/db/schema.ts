import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Money convention: every amount column is an integer number of PAISE
 * (1 rupee = 100 paise), stored as bigint. Never use floats for money.
 * Calendar dates (when a spend happened, when a bill is due) are plain
 * `date` columns, interpreted in the app's timezone (APP_TZ).
 */
const paise = (name: string) => bigint(name, { mode: "number" });

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ───────────────────────────── Auth (better-auth) ───────────────────────────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* ───────────────────────────────── App data ───────────────────────────────── */

export const incomeSource = pgEnum("income_source", ["Salary", "Freelance", "Side projects", "Other", "Loan"]);
export const recurrence = pgEnum("recurrence", ["Once", "Monthly", "Yearly"]);

/** One row per user: budgets + a balance adjustment (opening balance). */
export const settings = pgTable(
  "settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    monthlyBudget: paise("monthly_budget").notNull().default(0),
    dailyBudget: paise("daily_budget").notNull().default(0),
    hardLimit: paise("hard_limit").notNull().default(0),
    /** Added to (Σ income − Σ spend) to get the real account balance. */
    balanceAdjustment: paise("balance_adjustment").notNull().default(0),
    /** When the user last entered their balance; null = never (with no history, the balance is unknown, not ₹0). */
    balanceSetAt: timestamp("balance_set_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check("settings_budgets_nonneg", sql`${t.monthlyBudget} >= 0 AND ${t.dailyBudget} >= 0 AND ${t.hardLimit} >= 0`),
  ],
);

export const category = pgTable(
  "category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon").notNull(),
    color: text("color").notNull(),
    budget: paise("budget").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    // Lets child tables use a composite FK that guarantees same-owner rows.
    unique("category_id_user_uq").on(t.id, t.userId),
    uniqueIndex("category_user_name_uq").on(t.userId, sql`lower(${t.name})`),
    check("category_budget_nonneg", sql`${t.budget} >= 0`),
    check("category_name_len", sql`char_length(${t.name}) BETWEEN 1 AND 40`),
    check("category_color_hex", sql`${t.color} ~ '^#[0-9A-Fa-f]{6}$'`),
    check("category_icon_fmt", sql`${t.icon} ~ '^ri-[a-z0-9-]+$'`),
  ],
);

export const bill = pgTable(
  "bill",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** All occurrences of one recurring bill share a series id. */
    seriesId: uuid("series_id").notNull().defaultRandom(),
    name: text("name").notNull(),
    amount: paise("amount").notNull(),
    dueOn: date("due_on", { mode: "string" }).notNull(),
    recurrence: recurrence("recurrence").notNull().default("Monthly"),
    categoryId: uuid("category_id").notNull(),
    ...timestamps,
  },
  (t) => [
    unique("bill_id_user_uq").on(t.id, t.userId),
    unique("bill_series_due_uq").on(t.seriesId, t.dueOn),
    foreignKey({ columns: [t.categoryId, t.userId], foreignColumns: [category.id, category.userId] }).onDelete(
      "restrict",
    ),
    index("bill_user_due_idx").on(t.userId, t.dueOn),
    check("bill_amount_pos", sql`${t.amount} > 0`),
    check("bill_name_len", sql`char_length(${t.name}) BETWEEN 1 AND 80`),
  ],
);

export const transaction = pgTable(
  "transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").notNull(),
    amount: paise("amount").notNull(),
    note: text("note").notNull().default(""),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    /** Set when this spend was created by ticking a bill as paid. */
    billId: uuid("bill_id"),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.categoryId, t.userId], foreignColumns: [category.id, category.userId] }).onDelete(
      "restrict",
    ),
    foreignKey({ columns: [t.billId, t.userId], foreignColumns: [bill.id, bill.userId] }).onDelete("cascade"),
    // A bill can be paid at most once.
    uniqueIndex("transaction_bill_uq").on(t.billId).where(sql`${t.billId} IS NOT NULL`),
    index("transaction_user_date_idx").on(t.userId, t.occurredOn),
    check("transaction_amount_pos", sql`${t.amount} > 0`),
    check("transaction_note_len", sql`char_length(${t.note}) <= 120`),
  ],
);

export const income = pgTable(
  "income",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    source: incomeSource("source").notNull(),
    amount: paise("amount").notNull(),
    note: text("note").notNull().default(""),
    receivedOn: date("received_on", { mode: "string" }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("income_user_date_idx").on(t.userId, t.receivedOn),
    check("income_amount_pos", sql`${t.amount} > 0`),
    check("income_note_len", sql`char_length(${t.note}) <= 120`),
  ],
);

export const goal = pgTable(
  "goal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    target: paise("target").notNull(),
    monthly: paise("monthly").notNull(),
    /** Set while the goal is paused: it stays listed but its monthly amount isn't set aside. Goals are never deleted. */
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("goal_id_user_uq").on(t.id, t.userId),
    check("goal_target_pos", sql`${t.target} > 0`),
    check("goal_monthly_pos", sql`${t.monthly} > 0`),
    check("goal_name_len", sql`char_length(${t.name}) BETWEEN 1 AND 80`),
  ],
);

/** Money earmarked for a goal. Virtual — it never leaves the balance. */
export const goalContribution = pgTable(
  "goal_contribution",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    goalId: uuid("goal_id").notNull(),
    amount: paise("amount").notNull(),
    contributedOn: date("contributed_on", { mode: "string" }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.goalId, t.userId], foreignColumns: [goal.id, goal.userId] }).onDelete("cascade"),
    index("goal_contribution_goal_idx").on(t.goalId),
    check("goal_contribution_amount_pos", sql`${t.amount} > 0`),
  ],
);
