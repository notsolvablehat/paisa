CREATE TYPE "public"."income_source" AS ENUM('Salary', 'Freelance', 'Side projects', 'Other');--> statement-breakpoint
CREATE TYPE "public"."recurrence" AS ENUM('Once', 'Monthly', 'Yearly');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"series_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"amount" bigint NOT NULL,
	"due_on" date NOT NULL,
	"recurrence" "recurrence" DEFAULT 'Monthly' NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "bill_series_due_uq" UNIQUE("series_id","due_on"),
	CONSTRAINT "bill_amount_pos" CHECK ("bill"."amount" > 0),
	CONSTRAINT "bill_name_len" CHECK (char_length("bill"."name") BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"budget" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "category_budget_nonneg" CHECK ("category"."budget" >= 0),
	CONSTRAINT "category_name_len" CHECK (char_length("category"."name") BETWEEN 1 AND 40),
	CONSTRAINT "category_color_hex" CHECK ("category"."color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "category_icon_fmt" CHECK ("category"."icon" ~ '^ri-[a-z0-9-]+$')
);
--> statement-breakpoint
CREATE TABLE "goal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"target" bigint NOT NULL,
	"monthly" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "goal_target_pos" CHECK ("goal"."target" > 0),
	CONSTRAINT "goal_monthly_pos" CHECK ("goal"."monthly" > 0),
	CONSTRAINT "goal_name_len" CHECK (char_length("goal"."name") BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE TABLE "goal_contribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"goal_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"contributed_on" date NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_contribution_amount_pos" CHECK ("goal_contribution"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "income" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source" "income_source" NOT NULL,
	"amount" bigint NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"received_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "income_amount_pos" CHECK ("income"."amount" > 0),
	CONSTRAINT "income_note_len" CHECK (char_length("income"."note") <= 120)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"monthly_budget" bigint DEFAULT 0 NOT NULL,
	"daily_budget" bigint DEFAULT 0 NOT NULL,
	"hard_limit" bigint DEFAULT 0 NOT NULL,
	"balance_adjustment" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_budgets_nonneg" CHECK ("settings"."monthly_budget" >= 0 AND "settings"."daily_budget" >= 0 AND "settings"."hard_limit" >= 0)
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"occurred_on" date NOT NULL,
	"bill_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_amount_pos" CHECK ("transaction"."amount" > 0),
	CONSTRAINT "transaction_note_len" CHECK (char_length("transaction"."note") <= 120)
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_category_id_user_id_category_id_user_id_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."category"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contribution" ADD CONSTRAINT "goal_contribution_goal_id_user_id_goal_id_user_id_fk" FOREIGN KEY ("goal_id","user_id") REFERENCES "public"."goal"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_category_id_user_id_category_id_user_id_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."category"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_bill_id_user_id_bill_id_user_id_fk" FOREIGN KEY ("bill_id","user_id") REFERENCES "public"."bill"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bill_user_due_idx" ON "bill" USING btree ("user_id","due_on");--> statement-breakpoint
CREATE UNIQUE INDEX "category_user_name_uq" ON "category" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "goal_contribution_goal_idx" ON "goal_contribution" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "income_user_date_idx" ON "income" USING btree ("user_id","received_on");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_bill_uq" ON "transaction" USING btree ("bill_id") WHERE "transaction"."bill_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "transaction_user_date_idx" ON "transaction" USING btree ("user_id","occurred_on");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");