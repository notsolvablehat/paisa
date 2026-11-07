/**
 * Set a new password for an existing account (hashed the same way better-auth does).
 *   NEW_PASSWORD='…' npm run db:set-password -- you@example.com
 * Signs the account out everywhere, so sessions from the old password stop working.
 * Point DATABASE_URL at another database (e.g. Neon) to change it there.
 */
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { Pool } from "pg";

const MIN = 10; // matches lib/auth.ts
const MAX = 128;

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.env.NEW_PASSWORD ?? "";
  if (!email) throw new Error("Usage: NEW_PASSWORD='…' npm run db:set-password -- you@example.com");
  if (password.length < MIN || password.length > MAX) throw new Error(`NEW_PASSWORD must be ${MIN}–${MAX} characters.`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const hash = await hashPassword(password);
    await client.query("begin");
    const { rows } = await client.query<{ id: string }>(`select id from "user" where lower(email) = $1`, [email]);
    if (!rows[0]) throw new Error(`No account for ${email}.`);
    const userId = rows[0].id;
    const upd = await client.query(
      `update account set password = $1, updated_at = now() where user_id = $2 and provider_id = 'credential'`,
      [hash, userId],
    );
    if (upd.rowCount !== 1) throw new Error(`${email} has no email/password login to update.`);
    const sessions = await client.query(`delete from session where user_id = $1`, [userId]);

    const { rows: check } = await client.query<{ password: string }>(
      `select password from account where user_id = $1 and provider_id = 'credential'`,
      [userId],
    );
    if (!(await verifyPassword({ hash: check[0].password, password }))) throw new Error("Verification failed; nothing changed.");
    await client.query("commit");
    console.log(`Password updated for ${email}; signed out ${sessions.rowCount} session(s).`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
