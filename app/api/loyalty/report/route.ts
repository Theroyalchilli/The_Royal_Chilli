import { NextRequest, NextResponse } from "next/server";
import { bizDb } from "@/lib/business-db";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm } from "@/lib/permissions";
import { londonDateStr, tradingDayStr } from "@/lib/london-date";

export const dynamic = "force-dynamic";

// Rewards Club "second visit" report: customers grouped by the month they
// joined — how many made a 1st, 2nd and 3rd visit (a visit = a trading day
// with a paid order), what they've spent since, and what the rewards cost
// (discounts given through loyalty vouchers and points on their bills).
// GET ?months=12
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canViewCrm(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = bizDb(session.businessId);

  const months = Math.min(24, Math.max(1, Number(new URL(req.url).searchParams.get("months")) || 12));
  const now = new Date();
  const [y, m] = londonDateStr(now).split("-").map(Number);
  const firstMonth = new Date(Date.UTC(y, m - 1 - (months - 1), 1)).toISOString().slice(0, 7);

  const { data: customers } = await db.from("customers").select("id, created_at").is("merged_into", null);
  const { data: orders } = await db
    .from("orders")
    .select("customer_id, total, loyalty_discount, created_at")
    .eq("is_paid", true)
    .not("customer_id", "is", null);

  type Stats = { days: Set<string>; revenue: number; rewardCost: number };
  const byCustomer = new Map<number, Stats>();
  for (const o of orders ?? []) {
    const st = byCustomer.get(o.customer_id) ?? { days: new Set<string>(), revenue: 0, rewardCost: 0 };
    st.days.add(tradingDayStr(new Date(o.created_at)));
    st.revenue += Number(o.total) || 0;
    st.rewardCost += Number(o.loyalty_discount) || 0;
    byCustomer.set(o.customer_id, st);
  }

  type Row = { month: string; joined: number; visit1: number; visit2: number; visit3: number; revenue: number; rewardCost: number };
  const rows = new Map<string, Row>();
  for (let i = 0; i < months; i++) {
    const month = new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7);
    rows.set(month, { month, joined: 0, visit1: 0, visit2: 0, visit3: 0, revenue: 0, rewardCost: 0 });
  }
  for (const c of customers ?? []) {
    const month = londonDateStr(new Date(c.created_at)).slice(0, 7);
    const row = rows.get(month);
    if (!row || month < firstMonth) continue;
    const st = byCustomer.get(c.id);
    const visits = st?.days.size ?? 0;
    row.joined++;
    if (visits >= 1) row.visit1++;
    if (visits >= 2) row.visit2++;
    if (visits >= 3) row.visit3++;
    row.revenue += st?.revenue ?? 0;
    row.rewardCost += st?.rewardCost ?? 0;
  }

  const list = [...rows.values()].map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100, rewardCost: Math.round(r.rewardCost * 100) / 100 }));
  const total = list.reduce(
    (t, r) => ({
      joined: t.joined + r.joined,
      visit1: t.visit1 + r.visit1,
      visit2: t.visit2 + r.visit2,
      visit3: t.visit3 + r.visit3,
      revenue: Math.round((t.revenue + r.revenue) * 100) / 100,
      rewardCost: Math.round((t.rewardCost + r.rewardCost) * 100) / 100,
    }),
    { joined: 0, visit1: 0, visit2: 0, visit3: 0, revenue: 0, rewardCost: 0 },
  );
  return NextResponse.json({ months: list, total });
}
