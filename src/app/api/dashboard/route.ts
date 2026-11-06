import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { ISO_MONTH, todayISO } from "@/lib/dates";
import { getDashboard } from "@/server/queries";
import { requireUserId, UnauthorizedError } from "@/server/session";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const today = todayISO();
    const monthParam = req.nextUrl.searchParams.get("month");
    const month = monthParam && ISO_MONTH.test(monthParam) ? monthParam : today.slice(0, 7);
    const data = await getDashboard(userId, month, today);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/dashboard failed", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
