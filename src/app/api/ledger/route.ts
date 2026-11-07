import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { addDays, diffDays, ISO_DATE, todayISO } from "@/lib/dates";
import { getLedger } from "@/server/queries";
import { requireUserId, UnauthorizedError } from "@/server/session";

const MAX_SPAN_DAYS = 3 * 366;

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const today = todayISO();
    const q = req.nextUrl.searchParams;
    const to = valid(q.get("to")) ?? today;
    const from = valid(q.get("from")) ?? addDays(to, -89);
    if (from > to || diffDays(from, to) > MAX_SPAN_DAYS) {
      return NextResponse.json({ error: "Pick a range of up to three years" }, { status: 400 });
    }
    const data = await getLedger(userId, from, to);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("GET /api/ledger failed", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

function valid(s: string | null): string | null {
  if (!s || !ISO_DATE.test(s)) return null;
  // Round-trip through Date to reject things like 2026-02-31.
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}
