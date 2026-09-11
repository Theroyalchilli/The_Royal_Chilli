import supabase from "@/lib/supabase";
import { getItemSalesInRange } from "@/lib/analytics";

export type DashboardStat = { label: string; value: string; note?: string; tone?: "up" | "warn" | "neutral" };
export type TrendPoint = { date: string; label: string; revenue: number };
export type CostPoint = { date: string; label: string; revenue: number; cost: number };
export type HoursCostPoint = { date: string; label: string; hours: number; cost: number };
export type SlicePoint = { name: string; value: number };
export type HourPoint = { hour: string; revenue: number };
export type Alert = { tone: "rose" | "amber" | "teal"; text: string; sub?: string };
export type ShiftPerson = { name: string; since: string };
export type ReservationPreview = { name: string; time: string; partySize: number; status: string };

export type DashboardData = {
  kpis: DashboardStat[];
  // Admin — strategic/financial
  salesTrend?: TrendPoint[];
  staffCostVsRevenue?: CostPoint[];
  // Manager — real-time floor ops
  onShift?: ShiftPerson[];
  reservations?: ReservationPreview[];
  byHour?: HourPoint[];
  topItems?: SlicePoint[];
  // HR — people & compliance
  hoursCostTrend?: HoursCostPoint[];
  byRole?: SlicePoint[];
  alerts: Alert[];
};

type OrderRow = { id: number; total: number; order_type: string; created_at: string };
type AttendanceRow = { staff_id: number; work_date: string; net_work_seconds: number | null; late_seconds: number | null; clock_in: string | null; clock_out: string | null };

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
const timeToMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/** Restaurant-local (Europe/London) minute-of-day + ISO weekday (1=Mon..7=Sun). */
function londonNow(): { minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  const wd = parts.find((p) => p.type === "weekday")!.value;
  const ISO_WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { minutes: hour * 60 + minute, weekday: ISO_WD[wd] ?? 1 };
}
const CLOCKIN_GRACE_MIN = 15;

// ── Single shared fetches — each hits its table once per dashboard load. ────

async function paidOrdersForWeek(week: string[]): Promise<OrderRow[]> {
  const { data } = await supabase
    .from("orders")
    .select("id, total, order_type, created_at")
    .eq("status", "paid")
    .gte("created_at", `${week[0]}T00:00:00.000Z`)
    .lte("created_at", `${week[week.length - 1]}T23:59:59.999Z`);
  return data ?? [];
}

async function attendanceForWeek(week: string[]): Promise<AttendanceRow[]> {
  const { data } = await supabase
    .from("attendance")
    .select("staff_id, work_date, net_work_seconds, late_seconds, clock_in, clock_out")
    .gte("work_date", week[0])
    .lte("work_date", week[week.length - 1]);
  return data ?? [];
}

async function lowStockList(): Promise<{ name: string; current_stock: number; unit: string }[]> {
  const { data } = await supabase.from("ingredients").select("name, unit, current_stock, reorder_level").eq("active", 1);
  return (data ?? [])
    .filter((i) => Number(i.current_stock) <= Number(i.reorder_level))
    .map((i) => ({ name: i.name, current_stock: Number(i.current_stock), unit: i.unit }));
}

// ── Derivations ───────────────────────────────────────────────────────────

function deriveTrend(orders: OrderRow[], week: string[]): TrendPoint[] {
  const byDay = new Map<string, number>();
  for (const o of orders) byDay.set(o.created_at.slice(0, 10), (byDay.get(o.created_at.slice(0, 10)) ?? 0) + Number(o.total));
  return week.map((d) => ({ date: d, label: dayLabel(d), revenue: Math.round((byDay.get(d) ?? 0) * 100) / 100 }));
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
  return [...byItem.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value).slice(0, limit);
}

/** Hours worked + labour cost per day, from closed shifts (not payroll periods, which rarely align to single days). */
async function deriveDailyCost(attendance: AttendanceRow[], week: string[]): Promise<Map<string, { hours: number; cost: number }>> {
  const closed = attendance.filter((r) => r.clock_out);
  const staffIds = [...new Set(closed.map((r) => r.staff_id))];
  const { data: staffRows } = staffIds.length ? await supabase.from("staff").select("id, pay_rate").in("id", staffIds) : { data: [] };
  const rateById = new Map((staffRows ?? []).map((s) => [s.id, Number(s.pay_rate ?? 0)]));
  const byDay = new Map<string, { hours: number; cost: number }>();
  for (const r of closed) {
    if (!week.includes(r.work_date)) continue;
    const hours = Number(r.net_work_seconds ?? 0) / 3600;
    const cur = byDay.get(r.work_date) ?? { hours: 0, cost: 0 };
    cur.hours += hours;
    cur.cost += hours * (rateById.get(r.staff_id) ?? 0);
    byDay.set(r.work_date, cur);
  }
  return byDay;
}

/** Shifts still open from a *previous* day — clocked in, never clocked out. Today's still-open shifts are normal "on shift", not a miss. */
async function missedClockOuts(today: string): Promise<{ staff_id: number; work_date: string }[]> {
  const { data } = await supabase.from("attendance").select("staff_id, work_date").is("clock_out", null).not("clock_in", "is", null).lt("work_date", today);
  return data ?? [];
}

/** Active staff scheduled (per their default rota) to have started by now, with no clock-in today at all. Simplified — doesn't account for one-off shift overrides. */
async function missedClockIns(today: string): Promise<{ id: number; name: string; rota_start: string }[]> {
  const { minutes, weekday } = londonNow();
  const [{ data: staffRows }, { data: clockedIn }] = await Promise.all([
    supabase.from("staff").select("id, name, rota_start, rota_working_days").eq("active", 1).not("rota_start", "is", null),
    supabase.from("attendance").select("staff_id").eq("work_date", today).not("clock_in", "is", null),
  ]);
  const clockedInSet = new Set((clockedIn ?? []).map((r) => r.staff_id));
  return (staffRows ?? [])
    .filter((s) => (s.rota_working_days ?? [1, 2, 3, 4, 5]).includes(weekday))
    .filter((s) => timeToMinutes(s.rota_start!.slice(0, 5)) + CLOCKIN_GRACE_MIN <= minutes)
    .filter((s) => !clockedInSet.has(s.id))
    .map((s) => ({ id: s.id, name: s.name, rota_start: s.rota_start!.slice(0, 5) }));
}

async function todaysReservations(today: string, limit = 6): Promise<ReservationPreview[]> {
  const { data } = await supabase
    .from("reservations")
    .select("customer_name, party_size, reservation_time, status")
    .eq("reservation_date", today)
    .not("status", "in", '("cancelled","no_show")')
    .order("reservation_time")
    .limit(limit);
  return (data ?? []).map((r) => ({ name: r.customer_name, time: r.reservation_time.slice(0, 5), partySize: r.party_size, status: r.status }));
}

// Real numbers behind the Staff Hub dashboard — genuinely different content
// per role (not the same charts relabelled): Admin gets a strategic/
// financial view, Manager gets real-time floor operations, HR gets people
// & compliance. Orders/attendance are each fetched once per load and every
// metric derives from that in memory rather than re-querying per chart.
export async function getDashboardData(role: string): Promise<DashboardData> {
  const { today } = todayRange();
  const week = lastNDays(7);

  if (role === "admin") {
    const [orders, attendance, lowStock, pendingLeave, pendingCorr] = await Promise.all([
      paidOrdersForWeek(week),
      attendanceForWeek(week),
      lowStockList(),
      supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("attendance_corrections").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    const trend = deriveTrend(orders, week);
    const costByDay = await deriveDailyCost(attendance, week);
    const staffCostVsRevenue: CostPoint[] = week.map((d) => ({
      date: d,
      label: dayLabel(d),
      revenue: trend.find((t) => t.date === d)?.revenue ?? 0,
      cost: Math.round((costByDay.get(d)?.cost ?? 0) * 100) / 100,
    }));

    const todayRevenue = trend.find((t) => t.date === today)?.revenue ?? 0;
    const weekRevenue = trend.reduce((s, d) => s + d.revenue, 0);
    const weekCost = staffCostVsRevenue.reduce((s, d) => s + d.cost, 0);
    const labourPct = weekRevenue > 0 ? Math.round((weekCost / weekRevenue) * 1000) / 10 : 0;
    const pending = (pendingLeave.count ?? 0) + (pendingCorr.count ?? 0);

    const alerts: Alert[] = [
      ...(lowStock.length > 0 ? [{ tone: "rose" as const, text: `${lowStock.length} item${lowStock.length === 1 ? "" : "s"} low on stock`, sub: "See Inventory for details" }] : []),
      ...(pending > 0 ? [{ tone: "amber" as const, text: `${pending} pending approval${pending === 1 ? "" : "s"}`, sub: "Leave requests & attendance corrections" }] : []),
    ];

    return {
      kpis: [
        { label: "Today's Revenue", value: `£${todayRevenue.toFixed(2)}` },
        { label: "Weekly Revenue", value: `£${weekRevenue.toFixed(2)}`, note: "last 7 days" },
        { label: "Labour Cost %", value: `${labourPct}%`, note: "last 7 days", tone: labourPct > 30 ? "warn" : "neutral" },
        { label: "Pending Approvals", value: String(pending), note: pending > 0 ? "leave & corrections" : undefined, tone: "warn" },
      ],
      salesTrend: trend,
      staffCostVsRevenue,
      alerts,
    };
  }

  if (role === "manager") {
    const [orders, attendance, lowStock, missedOuts, missedIns, reservations, tablesRes] = await Promise.all([
      paidOrdersForWeek(week),
      attendanceForWeek(week),
      lowStockList(),
      missedClockOuts(today),
      missedClockIns(today),
      todaysReservations(today),
      supabase.from("restaurant_tables").select("status"),
    ]);

    const openToday = attendance.filter((r) => r.work_date === today && r.clock_in && !r.clock_out);
    const staffIds = [...new Set(openToday.map((r) => r.staff_id))];
    const { data: staffNames } = staffIds.length ? await supabase.from("staff").select("id, name").in("id", staffIds) : { data: [] };
    const nameById = new Map((staffNames ?? []).map((s) => [s.id, s.name]));
    const onShift: ShiftPerson[] = openToday.map((r) => ({
      name: nameById.get(r.staff_id) ?? "?",
      since: r.clock_in ? new Date(r.clock_in).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "—",
    }));

    const missedOutStaffIds = [...new Set(missedOuts.map((m) => m.staff_id))];
    const { data: missedOutNames } = missedOutStaffIds.length ? await supabase.from("staff").select("id, name").in("id", missedOutStaffIds) : { data: [] };
    const missedOutNameById = new Map((missedOutNames ?? []).map((s) => [s.id, s.name]));

    const tables = tablesRes.data ?? [];
    const occupied = tables.filter((t) => t.status === "occupied").length;

    const alerts: Alert[] = [
      ...missedIns.map((m) => ({ tone: "rose" as const, text: `${m.name} hasn't clocked in`, sub: `Rota'd to start at ${m.rota_start}` })),
      ...missedOuts.map((m) => ({ tone: "amber" as const, text: `${missedOutNameById.get(m.staff_id) ?? "Someone"} never clocked out`, sub: `${m.work_date} shift still open` })),
      ...lowStock.slice(0, 4).map((i) => ({ tone: "rose" as const, text: `${i.name} low on stock`, sub: `${i.current_stock} ${i.unit} left` })),
    ];

    return {
      kpis: [
        { label: "Staff Clocked In", value: String(onShift.length) },
        { label: "Missed Clock-Out", value: String(missedOuts.length), note: missedOuts.length > 0 ? "since a previous shift" : undefined, tone: missedOuts.length > 0 ? "warn" : "neutral" },
        { label: "Tables Occupied", value: `${occupied} / ${tables.length}` },
        { label: "Today's Reservations", value: String(reservations.length) },
      ],
      onShift,
      reservations,
      byHour: deriveHourlyToday(orders, today),
      topItems: await deriveTopItems(orders),
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
    const hoursCostTrend: HoursCostPoint[] = week.map((d) => ({
      date: d,
      label: dayLabel(d),
      hours: Math.round((costByDay.get(d)?.hours ?? 0) * 10) / 10,
      cost: Math.round((costByDay.get(d)?.cost ?? 0) * 100) / 100,
    }));

    const byRoleMap = new Map<string, number>();
    for (const r of roleCounts ?? []) byRoleMap.set(r.role, (byRoleMap.get(r.role) ?? 0) + 1);
    const ROLE_LABEL: Record<string, string> = { admin: "Admin", hr: "HR", manager: "Manager", employee: "Employee" };
    const byRole: SlicePoint[] = [...byRoleMap.entries()].map(([role, value]) => ({ name: ROLE_LABEL[role] ?? role, value }));

    const lateThisWeek = attendance.filter((r) => (r.late_seconds ?? 0) > 0).length;
    const missedOutThisWeek = attendance.filter((r) => r.clock_in && !r.clock_out && r.work_date < today && week.includes(r.work_date)).length;

    const alerts: Alert[] = [
      ...(pendingLeaveRows ?? []).map((r) => {
        const staffRow = r.staff as unknown as { name: string } | null;
        return { tone: "amber" as const, text: `${staffRow?.name ?? "Someone"} requested leave`, sub: `${r.leave_type} · from ${r.start_date}` };
      }),
      ...(lateThisWeek + missedOutThisWeek > 0
        ? [{ tone: "teal" as const, text: `${lateThisWeek} late arrival${lateThisWeek === 1 ? "" : "s"}, ${missedOutThisWeek} missed clock-out${missedOutThisWeek === 1 ? "" : "s"} this week`, sub: "Attendance compliance summary" }]
        : []),
    ];

    return {
      kpis: [
        { label: "Headcount", value: String(headcount.count ?? 0) },
        { label: "On Leave Today", value: String((onLeave ?? []).length) },
        { label: "Onboarding", value: String((recentHires ?? []).length), note: "hired in last 30 days" },
        { label: "Pending Leave Requests", value: String((pendingLeaveRows ?? []).length), note: (pendingLeaveRows ?? []).length > 0 ? "awaiting you" : undefined, tone: "warn" },
      ],
      hoursCostTrend,
      byRole,
      alerts,
    };
  }

  return { kpis: [], alerts: [] };
}
