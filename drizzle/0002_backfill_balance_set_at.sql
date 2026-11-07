-- Accounts that already entered a balance (non-zero adjustment) count as "known".
UPDATE "settings" SET "balance_set_at" = "updated_at" WHERE "balance_adjustment" <> 0 AND "balance_set_at" IS NULL;
