import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";
import { getPnl } from "@/lib/finance";

// Finance → Profit & Loss. Same calculation as the admin dashboard (lib/finance.ts).
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageFinance(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to are required" }, { status: 400 });

  try {
    return NextResponse.json(await getPnl(from, to));
  } catch (e) {
    console.error("P&L error:", e);
    return NextResponse.json({ error: "Failed to work out profit & loss" }, { status: 500 });
  }
}
