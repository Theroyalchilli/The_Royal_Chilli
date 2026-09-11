import supabase from "@/lib/supabase";
import { getPaidOrdersInRange, getItemSalesInRange } from "@/lib/analytics";

export type DashboardStat = { label: string; value: string; note?: string; tone?: "up" | "warn" | "neutral" };
export type TrendPoint = { date: string; label: string; revenue: number };
export type CostPoint = { date: string; label: string; revenue: number; cost: number };
export type SlicePoint = { name: string; value: number };
export type HourPoint = { hour: string; revenue: number };
export type Alert = { tone: "rose" | "amber" | "teal"; text: string; sub?: string };

export type DashboardData = {
  kpis: DashboardStat[];
  salesTrend?: TrendPoint[];
  staffCostVsRevenue?: CostPoint[];
  byType?: SlicePoint[];
  byHour?: HourPoint[];
  topItems?: SlicePoint[];
  alerts: Alert[];
};

function todayRange() {
  const today = new Date().toISOString().slice(0, 10);
  return { today, start: `${today}T00:00:00.000Z`, end: `${today}T23:59:59.999Z` };
}
function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
const dayLabel = (dateStr: string) => new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short" });

async function lowStockList(): Promise<{ name: string; current_stock: number; unit: string }[]> {
  const { data } = await supabase.from("ingredients").select("name, unit, current_stock, reorder_level").eq("active", 1);
  return (data ?? [])
    .filter((i) => Number(i.current_stock) <= Number(i.reorder_level))
    .map((i) => ({ name: i.name, current_stock: Number(i.current_stock), unit: i.unit }));
}

async function staffOnShiftCount(today: string): Promise<number> {
  const { data } = await supabase
    .from("attendance")
    .select("staff_id")
    .eq("work_date", today)
    .not("clock_in", "is", null)
    .is("clock_out", null);
  return new Set((data ?? []).map((r) => r.staff_id)).size;
}

/** Revenue + labour cost per day, from actual worked hours (not payroll periods, which rarely align to single days). */
async function dailyRevenueAndCost(days: string[]): Promise<CostPoint[]> {
  const from = days[0];
  const to = days[days.length - 1];
  const [orders, attRes] = await Promise.all([
    getPaidOrdersInRange(from, to),
    supabase.from("attendance").select("staff_id, work_date, net_work_seconds").gte("work_date", from).lte("work_date", to).not("clock_out", "is", null),
  ]);
  const attRows = attRes.data ?? [];
  const staffIds = [...new Set(attRows.map((r) => r.staff_id))];
  const { data: staffRows } = staffIds.length ? await supabase.from("staff").select("id, pay_rate").in("id", staffIds) : { data: [] };
  const rateById = new Map((staffRows ?? []).map((s) => [s.id, Number(s.pay_rate ?? 0)]));

  const revenueByDay = new Map<string, number>();
  for (const o of orders) {
    const day = o.created_at.slice(0, 10);
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(o.total));
  }
  const costByDay = new Map<string, number>();
  for (const r of attRows) {
    const rate = rateById.get(r.staff_id) ?? 0;
    const hours = Number(r.net_work_seconds ?? 0) / 3600;
    costByDay.set(r.work_date, (costByDay.get(r.work_date) ?? 0) + hours * rate);
  }
  return days.map((d) => ({
    date: d,
    label: dayLabel(d),
    revenue: Math.round((revenueByDay.get(d) ?? 0) * 100) / 100,
    cost: Math.round((costByDay.get(d) ?? 0) * 100) / 100,
  }));
}

async function byOrderType(from: string, to: string): Promise<SlicePoint[]> {
  const orders = await getPaidOrdersInRangeWithType(from, to);
  const totals = new Map<string, number>();
  for (const o of orders) totals.set(o.order_type, (totals.get(o.order_type) ?? 0) + Number(o.total));
  const LABEL: Record<string, string> = { dine_in: "Dine-In", takeaway: "Takeaway", delivery: "Delivery", online: "Online" };
  return [...totals.entries()].map(([type, value]) => ({ name: LABEL[type] ?? type, value: Math.round(value * 100) / 100 }));
}
async function getPaidOrdersInRangeWithType(from: string, to: string) {
  const { data } = await supabase
    .from("orders")
    .select("order_type, total")
    .eq("status", "paid")
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`);
  return data ?? [];
}

async function hourlyToday(): Promise<HourPoint[]> {
  const { today } = todayRange();
  const orders = await getPaidOrdersInRange(today, today);
  const byHour = new Map<number, number>();
  for (const o of orders) {
    const h = new Date(o.created_at).getUTCHours();
    byHour.set(h, (byHour.get(h) ?? 0) + Number(o.total));
  }
  return Array.from({ length: 24 }, (_, h) => h)
    .filter((h) => h >= 7 && h <= 23)
    .map((h) => ({ hour: `${h}:00`, revenue: Math.round((byHour.get(h) ?? 0) * 100) / 100 }));
}

async function topSellingItems(from: string, to: string, limit = 5): Promise<SlicePoint[]> {
  const orders = await getPaidOrdersInRange(from, to);
  const items = await getItemSalesInRange(orders.map((o) => o.id));
  const byItem = new Map<string, number>();
  for (const i of items) byItem.set(i.item_name, (byItem.get(i.item_name) ?? 0) + Number(i.item_price) * i.quantity);
  return [...byItem.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

// Real numbers behind the Staff Hub dashboard — different content per role,
// pulled from the same reports/analytics data already used elsewhere in
// Staff Hub (lib/analytics.ts, the Sales/Staff reports, inventory, HR).
export async function getDashboardData(role: string): Promise<DashboardData> {
  const { today, start, end } = todayRange();
  const week = lastNDays(7);

  if (role === "admin") {
    const [{ data: paidOrders }, onShift, lowStock, pendingLeave, pendingCorr, trend, byType, byHour, topItems] = await Promise.all([
      supabase.from("orders").select("total").eq("status", "paid").gte("created_at", start).lte("created_at", end),
      staffOnShiftCount(today),
      lowStockList(),
      supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("attendance_corrections").select("id", { count: "exact", head: true }).eq("status", "pending"),
      dailyRevenueAndCost(week),
      byOrderType(week[0], week[6]),
      hourlyToday(),
      topSellingItems(week[0], week[6]),
    ]);
    const revenue = (paidOrders ?? []).reduce((s, o) => s + Number(o.total), 0);
    const weekRevenue = trend.reduce((s, d) => s + d.revenue, 0);
    const weekCost = trend.reduce((s, d) => s + d.cost, 0);
    const labourPct = weekRevenue > 0 ? Math.round((weekCost / weekRevenue) * 1000) / 10 : 0;
    const pending = (pendingLeave.count ?? 0) + (pendingCorr.count ?? 0);

    const alerts: Alert[] = [
      ...lowStock.slice(0, 3).map((i) => ({ tone: "rose" as const, text: `${i.name} low on stock`, sub: `${i.current_stock} ${i.unit} left — reorder soon` })),
      ...(pending > 0 ? [{ tone: "amber" as const, text: `${pending} pending approval${pending === 1 ? "" : "s"}`, sub: "Leave requests & attendance corrections" }] : []),
    ];

    return {
      kpis: [
        { label: "Today's Revenue", value: `£${revenue.toFixed(2)}` },
        { label: "Staff on Shift", value: String(onShift) },
        { label: "Labour Cost %", value: `${labourPct}%`, note: "last 7 days", tone: labourPct > 30 ? "warn" : "neutral" },
        { label: "Pending Approvals", value: String(pending), note: pending > 0 ? "leave & corrections" : undefined, tone: "warn" },
      ],
      salesTrend: trend.map((d) => ({ date: d.date, label: d.label, revenue: d.revenue })),
      staffCostVsRevenue: trend,
      byType,
      byHour,
      topItems,
      alerts,
    };
  }

  if (role === "hr") {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const [headcount, { data: onLeave }, { data: recentHires }, { data: pendingLeaveRows }, { data: roleCounts }, trend] = await Promise.all([
      supabase.from("staff").select("id", { count: "exact", head: true }).eq("active", 1),
      supabase.from("leave_requests").select("id").eq("status", "approved").lte("start_date", today).gte("end_date", today),
      supabase.from("staff").select("id").eq("active", 1).gte("hire_date", thirtyDaysAgo),
      supabase.from("leave_requests").select("id, staff:staff!leave_requests_staff_id_fkey(name), leave_type, start_date").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
      supabase.from("staff").select("role").eq("active", 1),
      dailyRevenueAndCost(week), // reused for labour-cost trend (cost side only)
    ]);
    const byRole = new Map<string, number>();
    for (const r of roleCounts ?? []) byRole.set(r.role, (byRole.get(r.role) ?? 0) + 1);
    const ROLE_LABEL: Record<string, string> = { admin: "Admin", hr: "HR", manager: "Manager", employee: "Employee" };
    const byType: SlicePoint[] = [...byRole.entries()].map(([role, value]) => ({ name: ROLE_LABEL[role] ?? role, value }));

    const alerts: Alert[] = (pendingLeaveRows ?? []).map((r) => {
      const staffRow = r.staff as unknown as { name: string } | null;
      return { tone: "amber" as const, text: `${staffRow?.name ?? "Someone"} requested leave`, sub: `${r.leave_type} · from ${r.start_date}` };
    });

    return {
      kpis: [
        { label: "Headcount", value: String(headcount.count ?? 0) },
        { label: "On Leave Today", value: String((onLeave ?? []).length) },
        { label: "Onboarding", value: String((recentHires ?? []).length), note: "hired in last 30 days" },
        { label: "Pending Leave Requests", value: String((pendingLeaveRows ?? []).length), note: (pendingLeaveRows ?? []).length > 0 ? "awaiting you" : undefined, tone: "warn" },
      ],
      staffCostVsRevenue: trend,
      byType,
      alerts,
    };
  }

  if (role === "manager") {
    const [ordersToday, { data: tables }, lowStock, onShift, trend, byType, byHour, topItems] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).neq("status", "cancelled").gte("created_at", start).lte("created_at", end),
      supabase.from("restaurant_tables").select("status"),
      lowStockList(),
      staffOnShiftCount(today),
      dailyRevenueAndCost(week),
      byOrderType(week[0], week[6]),
      hourlyToday(),
      topSellingItems(week[0], week[6]),
    ]);
    const occupied = (tables ?? []).filter((t) => t.status === "occupied").length;

    const alerts: Alert[] = lowStock.slice(0, 4).map((i) => ({ tone: "rose" as const, text: `${i.name} low on stock`, sub: `${i.current_stock} ${i.unit} left` }));

    return {
      kpis: [
        { label: "Orders Today", value: String(ordersToday.count ?? 0) },
        { label: "Tables Occupied", value: `${occupied} / ${(tables ?? []).length}` },
        { label: "Low-Stock Items", value: String(lowStock.length), note: lowStock.length > 0 ? "needs reorder" : undefined, tone: "warn" },
        { label: "Staff Clocked In", value: String(onShift) },
      ],
      salesTrend: trend.map((d) => ({ date: d.date, label: d.label, revenue: d.revenue })),
      byType,
      byHour,
      topItems,
      alerts,
    };
  }

  return { kpis: [], alerts: [] };
}
