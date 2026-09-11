import supabase from "@/lib/supabase";

export type DashboardStat = {
  label: string;
  value: string;
  note?: string;
  tone?: "up" | "warn" | "neutral";
};

function todayRange() {
  const today = new Date().toISOString().slice(0, 10);
  return { today, start: `${today}T00:00:00.000Z`, end: `${today}T23:59:59.999Z` };
}

async function lowStockCount(): Promise<number> {
  const { data } = await supabase.from("ingredients").select("id, current_stock, reorder_level").eq("active", 1);
  return (data ?? []).filter((i) => Number(i.current_stock) <= Number(i.reorder_level)).length;
}

/** Distinct staff with an open (clocked-in, not yet out) attendance row today. */
async function staffOnShiftCount(today: string): Promise<number> {
  const { data } = await supabase
    .from("attendance")
    .select("staff_id")
    .eq("work_date", today)
    .not("clock_in", "is", null)
    .is("clock_out", null);
  return new Set((data ?? []).map((r) => r.staff_id)).size;
}

// Real numbers behind the Staff Hub welcome screen's stat row — one query set
// per role, kept deliberately simple (this is a glance, not a report).
export async function getDashboardStats(role: string): Promise<DashboardStat[]> {
  const { today, start, end } = todayRange();

  if (role === "admin") {
    const [{ data: paidOrders }, onShift, lowStock, pendingLeave, pendingCorr] = await Promise.all([
      supabase.from("orders").select("total").eq("status", "paid").gte("created_at", start).lte("created_at", end),
      staffOnShiftCount(today),
      lowStockCount(),
      supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("attendance_corrections").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    const revenue = (paidOrders ?? []).reduce((s, o) => s + Number(o.total), 0);
    const pending = (pendingLeave.count ?? 0) + (pendingCorr.count ?? 0);
    return [
      { label: "Today's Revenue", value: `£${revenue.toFixed(2)}` },
      { label: "Staff on Shift", value: String(onShift) },
      { label: "Low-Stock Items", value: String(lowStock), note: lowStock > 0 ? "needs reorder" : undefined, tone: "warn" },
      { label: "Pending Approvals", value: String(pending), note: pending > 0 ? "leave & corrections" : undefined, tone: "warn" },
    ];
  }

  if (role === "hr") {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const [headcount, { data: onLeave }, { data: recentHires }, pendingLeave] = await Promise.all([
      supabase.from("staff").select("id", { count: "exact", head: true }).eq("active", 1),
      supabase.from("leave_requests").select("id").eq("status", "approved").lte("start_date", today).gte("end_date", today),
      supabase.from("staff").select("id").eq("active", 1).gte("hire_date", thirtyDaysAgo),
      supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    return [
      { label: "Headcount", value: String(headcount.count ?? 0) },
      { label: "On Leave Today", value: String((onLeave ?? []).length) },
      { label: "Onboarding", value: String((recentHires ?? []).length), note: "hired in last 30 days" },
      {
        label: "Pending Leave Requests",
        value: String(pendingLeave.count ?? 0),
        note: (pendingLeave.count ?? 0) > 0 ? "awaiting you" : undefined,
        tone: "warn",
      },
    ];
  }

  if (role === "manager") {
    const [ordersToday, { data: tables }, lowStock, onShift] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).neq("status", "cancelled").gte("created_at", start).lte("created_at", end),
      supabase.from("restaurant_tables").select("status"),
      lowStockCount(),
      staffOnShiftCount(today),
    ]);
    const occupied = (tables ?? []).filter((t) => t.status === "occupied").length;
    return [
      { label: "Orders Today", value: String(ordersToday.count ?? 0) },
      { label: "Tables Occupied", value: `${occupied} / ${(tables ?? []).length}` },
      { label: "Low-Stock Items", value: String(lowStock), note: lowStock > 0 ? "needs reorder" : undefined, tone: "warn" },
      { label: "Staff Clocked In", value: String(onShift) },
    ];
  }

  return [];
}
