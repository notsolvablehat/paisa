/**
 * Copy ONE account (login + all of its data) between databases. Nothing from other users.
 *
 *   npm run data:export -- you@example.com                      → data/<email>.json (reads DATABASE_URL)
 *   TARGET_DATABASE_URL=… npm run data:import -- data/<email>.json [--replace]
 *
 * Exported: the user, its email/password login (hash only), settings, categories, bills,
 * goals, goal contributions, spends, income. Not exported: sessions, verifications.
 * IDs are kept, so links between rows (bill → spend, goal → contribution) survive.
 *
 * Import runs in one transaction. If the target already has this account, it is replaced
 * only with --replace; otherwise the import stops without changing anything.
 * The target must already be migrated: `DATABASE_URL=… npm run db:migrate`.
 *
 * The JSON holds a password hash and personal finance data; `data/` is gitignored.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

// Keep values exactly as Postgres prints them: no timezone shifts on `date`, no bigint → float.
for (const oid of [20, 1082, 1114, 1184]) pg.types.setTypeParser(oid, (v: string) => v);

/** Insert order respects foreign keys. */
const TABLES = ["settings", "category", "bill", "goal", "goal_contribution", "transaction", "income"] as const;
type Row = Record<string, unknown>;
type Dump = {
  version: 1;
  exportedAt: string;
  email: string;
  user: Row;
  account: Row[];
  data: Record<(typeof TABLES)[number], Row[]>;
};

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function exportAccount(email: string) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: users } = await pool.query(`select * from "user" where lower(email) = lower($1)`, [email]);
    if (!users[0]) throw new Error(`No account for ${email} in DATABASE_URL.`);
    const user = users[0];
    const { rows: account } = await pool.query(`select * from account where user_id = $1`, [user.id]);
    const data = {} as Dump["data"];
    for (const t of TABLES) data[t] = (await pool.query(`select * from ${ident(t)} where user_id = $1`, [user.id])).rows;

    const dump: Dump = { version: 1, exportedAt: new Date().toISOString(), email: user.email, user, account, data };
    mkdirSync("data", { recursive: true });
    const file = join("data", `${user.email}.json`);
    writeFileSync(file, JSON.stringify(dump, null, 2), { mode: 0o600 });
    console.log(`Exported ${user.email} → ${file}`);
    for (const t of TABLES) console.log(`  ${t.padEnd(18)} ${data[t].length}`);
  } finally {
    await pool.end();
  }
}

async function insertRows(client: pg.PoolClient, table: string, rows: Row[]) {
  for (const row of rows) {
    const cols = Object.keys(row);
    await client.query(
      `insert into ${ident(table)} (${cols.map(ident).join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
      cols.map((c) => row[c]),
    );
  }
}

async function importAccount(file: string, replace: boolean) {
  const url = process.env.TARGET_DATABASE_URL;
  if (!url) throw new Error("Set TARGET_DATABASE_URL to the database to import into (kept separate from DATABASE_URL on purpose).");
  const dump = JSON.parse(readFileSync(file, "utf8")) as Dump;
  if (dump.version !== 1) throw new Error(`Unsupported dump version ${dump.version}.`);

  const pool = new pg.Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows: existing } = await client.query<{ id: string }>(
      `select id from "user" where lower(email) = lower($1) or id = $2`,
      [dump.email, dump.user.id],
    );
    if (existing.length) {
      if (!replace) throw new Error(`${dump.email} already exists in the target. Re-run with --replace to overwrite it.`);
      // Cascades remove that account's login, sessions and all of its app data.
      await client.query(`delete from "user" where id = any($1)`, [existing.map((r) => r.id)]);
    }
    await insertRows(client, "user", [dump.user]);
    await insertRows(client, "account", dump.account);
    for (const t of TABLES) await insertRows(client, t, dump.data[t]);
    await client.query("commit");
    console.log(`Imported ${dump.email} (exported ${dump.exportedAt})`);
    for (const t of TABLES) console.log(`  ${t.padEnd(18)} ${dump.data[t].length}`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const [cmd, arg, ...flags] = process.argv.slice(2);
  if (cmd === "export" && arg) return exportAccount(arg);
  if (cmd === "import" && arg) return importAccount(arg, flags.includes("--replace"));
  throw new Error("Usage: account-data.ts export <email> | import <file.json> [--replace]");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
