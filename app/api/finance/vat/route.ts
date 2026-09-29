import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";
import { getPnl } from "@/lib/finance";

// Estimate only — for the restaurant's accountant to verify, not an HMRC-ready figure.
// Assumes: sales are standard-rated (hot food), raw ingredient purchases are zero-rated
// (typical for UK food wholesale) so they're excluded from input VAT, and only expenses
// explicitly marked vat_applicable count toward input VAT. Figures come from the same
// calculation as the P&L (lib/finance.ts), so the two tabs always agree.
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
    const p = await getPnl(from, to);
    return NextResponse.json({ from, to, vat_rate: p.vat_rate, sales: p.sales, vat: p.vat });
  } catch (e) {
    console.error("VAT error:", e);
    return NextResponse.json({ error: "Failed to work out VAT" }, { status: 500 });
  }
}
