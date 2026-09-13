import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";
import { getRevenue, getOtherExpenses, extractVat, getOutputVatCollected, getVatRate } from "@/lib/finance";

// Estimate only — for the restaurant's accountant to verify, not an HMRC-ready figure.
// Assumes: sales are standard-rated (hot food), raw ingredient purchases are zero-rated
// (typical for UK food wholesale) so they're excluded from input VAT, and only expenses
// explicitly marked vat_applicable count toward input VAT.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageFinance(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to are required" }, { status: 400 });

  const [revenue, outputVat, expenses, vatRate] = await Promise.all([
    getRevenue(from, to),
    getOutputVatCollected(from, to),
    getOtherExpenses(from, to),
    getVatRate(),
  ]);

  const inputVat = extractVat(expenses.vatApplicableTotal, vatRate);
  const netVatDue = Math.round((outputVat - inputVat) * 100) / 100;

  return NextResponse.json({
    from, to, vat_rate: vatRate,
    revenue, output_vat: outputVat,
    vat_applicable_expenses: expenses.vatApplicableTotal, input_vat: inputVat,
    net_vat_due: netVatDue,
  });
}
