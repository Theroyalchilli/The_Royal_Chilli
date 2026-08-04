import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";
import { getPaidOrdersInRange } from "@/lib/analytics";
import { getLabourCost } from "@/lib/finance";
import supabase from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageStaff(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to are required" }, { status: 400 });

  const orders = await getPaidOrdersInRange(from, to);
  const bySales = new Map<number, { orders: number; revenue: number }>();
  for (const o of orders) {
    if (!o.staff_id) continue;
    const cur = bySales.get(o.staff_id) || { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(o.total);
    bySales.set(o.staff_id, cur);
  }

  const { data: staff } = await supabase.from("staff").select("id, name").eq("active", 1);
  const staffPerformance = (staff || [])
    .map((s) => {
      const stats = bySales.get(s.id) || { orders: 0, revenue: 0 };
      return { staff_id: s.id, name: s.name, orders_handled: stats.orders, sales: Math.round(stats.revenue * 100) / 100 };
    })
    .filter((s) => s.orders_handled > 0)
    .sort((a, b) => b.sales - a.sales);

  const labourCost = await getLabourCost(from, to);

  return NextResponse.json({ staff_performance: staffPerformance, labour_cost: labourCost });
}
