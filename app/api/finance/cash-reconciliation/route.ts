import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageFinance(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: periods, error } = await supabase
    .from("work_periods")
    .select("*")
    .eq("status", "closed")
    .order("opened_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: "Failed to fetch work periods" }, { status: 500 });

  const results = [];
  for (const period of periods || []) {
    const { data: orders } = await supabase.from("orders").select("id").eq("work_period_id", period.id);
    const orderIds = (orders || []).map((o) => o.id);

    let cashTotal = 0;
    if (orderIds.length > 0) {
      const { data: payments } = await supabase.from("payments").select("amount").eq("method", "cash").in("order_id", orderIds);
      cashTotal = (payments || []).reduce((s, p) => s + Number(p.amount), 0);
    }

    const expectedCash = Math.round((Number(period.opening_cash) + cashTotal) * 100) / 100;
    const actualCash = period.closing_cash !== null ? Number(period.closing_cash) : null;
    const variance = actualCash !== null ? Math.round((actualCash - expectedCash) * 100) / 100 : null;

    results.push({ ...period, cash_sales: Math.round(cashTotal * 100) / 100, expected_cash: expectedCash, actual_cash: actualCash, variance });
  }

  return NextResponse.json({ periods: results });
}
