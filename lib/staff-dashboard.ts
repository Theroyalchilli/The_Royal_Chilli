import supabase from "@/lib/supabase";
import { getItemSalesInRange } from "@/lib/analytics";

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

type OrderRow = { id: number; total: number; order_type: string; created_at: string };
type AttendanceRow = { staff_id: number; work_date: string; net_work_seconds: number | null; clock_in: string | null; clock_out: string | null };

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
const ORDER_TYPE_LABEL: Record<string, string> = { dine_in: "Dine-In", takeaway: "Takeaway", delivery: "Delivery", online: "Online" };

// ── Single shared fetches — each hits its table once per dashboard load,
// everything else below derives from these in memory instead of re-querying. ──

async function paidOrdersForWeek(week: string[]): Promise<OrderRow[]> {
  const from = week[0];
  const to = week[week.length - 1];
  const { data } = await supabase
    .from("orders")
    .select("id, total, order_type, created_at")
    .eq("status", "paid")
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`);
  return data ?? [];
}

async function attendanceForWeek(week: string[]): Promise<AttendanceRow[]> {
  const from = week[0];
  const to = week[week.length - 1];
  const { data } = await supabase
    .from("attendance")
    .select("staff_id, work_date, net_work_seconds, clock_in, clock_out")
    .gte("work_date", from)
    .lte("work_date", to);
  return data ?? [];
}

async function lowStockList(): Promise<{ name: string; current_stock: number; unit: string }[]> {
  const { data } = await supabase.from("ingredients").select("name, unit, current_stock, reorder_level").eq("active", 1);
  return (data ?? [])
    .filter((i) => Number(i.current_stock) <= Number(i.reorder_level))
    .map((i) => ({ name: i.name, current_stock: Number(i.current_stock), unit: i.unit }));
}

// ── Derivations — all in-memory, no extra queries ───────────────────────────

function deriveTrend(orders: OrderRow[], week: string[]): TrendPoint[] {
  const byDay = new Map<string, number>();
  for (const o of orders) byDay.set(o.created_at.slice(0, 10), (byDay.get(o.created_at.slice(0, 10)) ?? 0) + Number(o.total));
  return week.map((d) => ({ date: d, label: dayLabel(d), revenue: Math.round((byDay.get(d) ?? 0) * 100) / 100 }));
}

function deriveByType(orders: OrderRow[]): SlicePoint[] {
  const totals = new Map<string, number>();
  for (const o of orders) totals.set(o.order_type, (totals.get(o.order_type) ?? 0) + Number(o.total));
  return [...totals.entries()].map(([type, value]) => ({ name: ORDER_TYPE_LABEL[type] ?? type, value: Math.round(value * 100) / 100 }));
}

function deriveHourlyToday(orders: OrderRow[], today: string): HourPoint[] {
  const byHour = new Map<number, number>();
  for (const o of orders) {
    if (!o.created_at.startsWith(today)) continue;
    const h = new Date(o.created_at).getUTCHours();
    byHour.set(h, (byHour.get(h) ?? 0) + Number(o.total));
  }
  return Array.from({ length: 24 }, (_, h) => h)
    .filter((h) => h >= 7 && h <= 23)
    .map((h) => ({ hour: `${h}:00`, revenue: Math.round((byHour.get(h) ?? 0) * 100) / 100 }));
}

async function deriveTopItems(orders: OrderRow[], limit = 5): Promise<SlicePoint[]> {
  if (orders.length === 0) return [];
  const items = await getItemSalesInRange(orders.map((o) => o.id));
  const byItem = new Map<string, number>();
  for (const i of items) byItem.set(i.item_name, (byItem.get(i.item_name) ?? 0) + Number(i.item_price) * i.quantity);
  return [...byItem.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function deriveOnShift(attendance: AttendanceRow[], today: string): number {
  return new Set(attendance.filter((r) => r.work_date === today && r.clock_in && !r.clock_out).map((r) => r.staff_id)).size;
}

/** Labour cost per day, from actual worked hours on closed shifts (not payroll periods, which rarely align to single days). */
async function deriveDailyCost(attendance: AttendanceRow[], week: string[]): Promise<Map<string, number>> {
  const closed = attendance.filter((r) => r.clock_out);
  const staffIds = [...new Set(closed.map((r) => r.staff_id))];
  const { data: staffRows } = staffIds.length ? await supabase.from("staff").select("id, pay_rate").in("id", staffIds) : { data: [] };
  const rateById = new Map((staffRows ?? []).map((s) => [s.id, Number(s.pay_rate ?? 0)]));
  const costByDay = new Map<string, number>();
  for (const r of closed) {
    if (!week.includes(r.work_date)) continue;
    const hours = Number(r.net_work_seconds ?? 0) / 3600;
    costByDay.set(r.work_date, (costByDay.get(r.work_date) ?? 0) + hours * (rateById.get(r.staff_id) ?? 0));
  }
  return costByDay;
}

// Real numbers behind the Staff Hub dashboard — different content per role,
// pulled from the same reports/analytics data already used elsewhere in
// Staff Hub (lib/analytics.ts, the Sales/Staff reports, inventory, HR).
// Each table (orders, attendance) is fetched once per load and every metric
// below is derived from that in memory, rather than re-querying per chart.
export async function getDashboardData(role: string): Promise<DashboardData> {
  const { today } = todayRange();
  const week = lastNDays(7);

  if (role === "admin" || role === "manager") {
    const [orders, attendance, lowStock, tablesRes, pendingLeave, pendingCorr] = await Promise.all([
      paidOrdersForWeek(week),
      attendanceForWeek(week),
      lowStockList(),
      role === "manager" ? supabase.from("restaurant_tables").select("status") : Promise.resolve({ data: null }),
      supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("attendance_corrections").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    const trend = deriveTrend(orders, week);
    const byType = deriveByType(orders);
    const byHour = deriveHourlyToday(orders, today);
    const onShift = deriveOnShift(attendance, today);
    const [topItems, costByDay] = await Promise.all([deriveTopItems(orders), deriveDailyCost(attendance, week)]);

    const todayRevenue = trend.find((t) => t.date === today)?.revenue ?? 0;
    const weekRevenue = trend.reduce((s, d) => s + d.revenue, 0);
    const weekCost = week.reduce((s, d) => s + (costByDay.get(d) ?? 0), 0);
    const pending = (pendingLeave.count ?? 0) + (pendingCorr.count ?? 0);

    if (role === "admin") {
      const labourPct = weekRevenue > 0 ? Math.round((weekCost / weekRevenue) * 1000) / 10 : 0;
      const alerts: Alert[] = [
        ...lowStock.slice(0, 3).map((i) => ({ tone: "rose" as const, text: `${i.name} low on stock`, sub: `${i.current_stock} ${i.unit} left — reorder soon` })),
        ...(pending > 0 ? [{ tone: "amber" as const, text: `${pending} pending approval${pending === 1 ? "" : "s"}`, sub: "Leave requests & attendance corrections" }] : []),
      ];
      return {
        kpis: [
          { label: "Today's Revenue", value: `£${todayRevenue.toFixed(2)}` },
          { label: "Staff on Shift", value: String(onShift) },
          { label: "Labour Cost %", value: `${labourPct}%`, note: "last 7 days", tone: labourPct > 30 ? "warn" : "neutral" },
          { label: "Pending Approvals", value: String(pending), note: pending > 0 ? "leave & corrections" : undefined, tone: "warn" },
        ],
        salesTrend: trend,
        staffCostVsRevenue: week.map((d) => ({ date: d, label: dayLabel(d), revenue: trend.find((t) => t.date === d)?.revenue ?? 0, cost: Math.round((costByDay.get(d) ?? 0) * 100) / 100 })),
        byType,
        byHour,
        topItems,
        alerts,
      };
    }

    // manager
    const tables = tablesRes.data ?? [];
    const occupied = tables.filter((t) => t.status === "occupied").length;
    const alerts: Alert[] = lowStock.slice(0, 4).map((i) => ({ tone: "rose" as const, text: `${i.name} low on stock`, sub: `${i.current_stock} ${i.unit} left` }));
    const { count: ordersTodayCount } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .neq("status", "cancelled")
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lte("created_at", `${today}T23:59:59.999Z`);
    return {
      kpis: [
        { label: "Orders Today", value: String(ordersTodayCount ?? 0) },
        { label: "Tables Occupied", value: `${occupied} / ${tables.length}` },
        { label: "Low-Stock Items", value: String(lowStock.length), note: lowStock.length > 0 ? "needs reorder" : undefined, tone: "warn" },
        { label: "Staff Clocked In", value: String(onShift) },
      ],
      salesTrend: trend,
      byType,
      byHour,
      topItems,
      alerts,
    };
  }

  if (role === "hr") {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const [headcount, { data: onLeave }, { data: recentHires }, { data: pendingLeaveRows }, { data: roleCounts }, attendance] = await Promise.all([
      supabase.from("staff").select("id", { count: "exact", head: true }).eq("active", 1),
      supabase.from("leave_requests").select("id").eq("status", "approved").lte("start_date", today).gte("end_date", today),
      supabase.from("staff").select("id").eq("active", 1).gte("hire_date", thirtyDaysAgo),
      supabase.from("leave_requests").select("id, staff:staff!leave_requests_staff_id_fkey(name), leave_type, start_date").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
      supabase.from("staff").select("role").eq("active", 1),
      attendanceForWeek(week),
    ]);
    const costByDay = await deriveDailyCost(attendance, week);
    const trend = week.map((d) => ({ date: d, label: dayLabel(d), revenue: 0, cost: Math.round((costByDay.get(d) ?? 0) * 100) / 100 }));

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

  return { kpis: [], alerts: [] };
}
