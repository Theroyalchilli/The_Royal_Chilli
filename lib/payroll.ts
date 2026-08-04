import supabase from "@/lib/supabase";

// Sums actual worked hours per staff member from clock_events within [periodStart, periodEnd],
// subtracting any breaks taken. Only closed (clocked-out) events count.
export async function computeHoursForPeriod(periodStart: string, periodEnd: string): Promise<Map<number, number>> {
  const rangeStart = `${periodStart}T00:00:00.000Z`;
  const rangeEnd = `${periodEnd}T23:59:59.999Z`;

  const { data: events, error } = await supabase
    .from("clock_events")
    .select("id, staff_id, clock_in, clock_out")
    .eq("status", "closed")
    .gte("clock_in", rangeStart)
    .lte("clock_in", rangeEnd);
  if (error) throw error;
  if (!events || events.length === 0) return new Map();

  const eventIds = events.map((e) => e.id);
  const { data: breaks } = await supabase
    .from("breaks")
    .select("clock_event_id, break_start, break_end")
    .in("clock_event_id", eventIds)
    .not("break_end", "is", null);

  const breakMsByEvent = new Map<number, number>();
  for (const b of breaks || []) {
    const ms = new Date(b.break_end).getTime() - new Date(b.break_start).getTime();
    breakMsByEvent.set(b.clock_event_id, (breakMsByEvent.get(b.clock_event_id) || 0) + ms);
  }

  const hoursByStaff = new Map<number, number>();
  for (const e of events) {
    const grossMs = new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime();
    const netMs = grossMs - (breakMsByEvent.get(e.id) || 0);
    const hours = Math.max(0, netMs / 3_600_000);
    hoursByStaff.set(e.staff_id, (hoursByStaff.get(e.staff_id) || 0) + hours);
  }

  return hoursByStaff;
}

export function computeGrossPay(entry: {
  base_pay: number; bonuses: number; tips: number; deductions: number; holiday_pay: number;
}): number {
  return Math.round((entry.base_pay + entry.bonuses + entry.tips + entry.holiday_pay - entry.deductions) * 100) / 100;
}
