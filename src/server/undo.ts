import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Undo for every write. An action that changes data also describes how to reverse it (delete what it
 * created, put back old values, re-insert what it removed). That recipe goes back to the browser as a
 * signed token that expires after UNDO_WINDOW_MS; after that the change is permanent. The token is
 * HMAC-signed with the auth secret and bound to the user, so it can't be forged, reused by someone
 * else, or replayed later.
 */
export const UNDO_WINDOW_MS = 5_000;
/** Slack for slow networks: the browser already stops offering Undo at 5 s; this only lets a click made in time still land. */
const GRACE_MS = 10_000;

const { settings, category, transaction: txn, income, goal, goalContribution, bill } = schema;
const TABLES = { txn, income, goal, goalContribution, bill, category } as const;
export type UndoTable = keyof typeof TABLES;

type Row = Record<string, unknown>;
export type UndoStep =
  | { op: "del"; table: UndoTable; ids: string[] }
  | { op: "ins"; table: UndoTable; rows: Row[] }
  | { op: "upd"; table: UndoTable; id: string; set: Row }
  | { op: "settings"; set: Row };

type Payload = { u: string; e: number; s: UndoStep[] };

function secret() {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is not set");
  return s;
}
const sign = (body: string) => createHmac("sha256", secret()).update(`undo:${body}`).digest("base64url");

export function makeUndoToken(userId: string, steps: UndoStep[]): string {
  const body = Buffer.from(JSON.stringify({ u: userId, e: Date.now() + UNDO_WINDOW_MS, s: steps } satisfies Payload)).toString(
    "base64url",
  );
  return `${body}.${sign(body)}`;
}

export class UndoRejected extends Error {}

/** Returns the steps, or throws UndoRejected (bad signature, someone else's, or too late). */
export function readUndoToken(token: string, userId: string): UndoStep[] {
  const [body, mac] = token.split(".");
  if (!body || !mac) throw new UndoRejected("That can't be undone.");
  const want = Buffer.from(sign(body)), got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) throw new UndoRejected("That can't be undone.");
  const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
  if (p.u !== userId) throw new UndoRejected("That can't be undone.");
  if (Date.now() > p.e + GRACE_MS) throw new UndoRejected("Too late to undo — that change is saved.");
  return p.s;
}

/** JSON turned timestamps into strings; Drizzle wants Dates back for timestamp columns. */
const TIMESTAMP_KEYS = new Set(["createdAt", "updatedAt", "pausedAt", "balanceSetAt"]);
function revive(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[k] = TIMESTAMP_KEYS.has(k) && typeof v === "string" ? new Date(v) : v;
  return out;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Runs the steps in order inside the caller's transaction. Every statement is scoped to the user. */
export async function runUndo(tx: Tx, userId: string, steps: UndoStep[]) {
  for (const s of steps) {
    if (s.op === "settings") {
      await tx.update(settings).set(revive(s.set)).where(eq(settings.userId, userId));
      continue;
    }
    const t = TABLES[s.table];
    if (s.op === "del") {
      if (s.ids.length) await tx.delete(t).where(and(inArray(t.id, s.ids), eq(t.userId, userId)));
    } else if (s.op === "ins") {
      if (s.rows.length)
        await tx
          .insert(t)
          .values(s.rows.map((r) => ({ ...revive(r), userId })) as never)
          .onConflictDoNothing();
    } else {
      await tx
        .update(t)
        .set(revive(s.set) as never)
        .where(and(eq(t.id, s.id), eq(t.userId, userId)));
    }
  }
}
