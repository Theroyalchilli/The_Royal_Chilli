import supabase from "@/lib/supabase";

// Worked hours per staff member for a payroll period, taken from the attendance
// app's LOCKED weekly timesheets (royal-chilli-attendance — same database).
// A timesheet counts only if it sits entirely within [periodStart, periodEnd]
// and is locked, so a period can't be run until its weeks are approved + locked.
export async function computeHoursForPeriod(
  periodStart: string,
  periodEnd: string,
): Promise<Map<number, number>> {
  const { data: sheets, error } = await supabase
    .from("timesheets")
    .select("staff_id, totals")
    .eq("locked", true)
    .gte("period_start", periodStart)
    .lte("period_end", periodEnd);
  if (error) throw error;

  const hoursByStaff = new Map<number, number>();
  for (const s of sheets ?? []) {
    const netSeconds = Number((s.totals as { net_seconds?: number } | null)?.net_seconds ?? 0);
    hoursByStaff.set(s.staff_id, (hoursByStaff.get(s.staff_id) ?? 0) + netSeconds / 3600);
  }
  return hoursByStaff;
}

export function computeGrossPay(entry: {
  base_pay: number; bonuses: number; tips: number; deductions: number; holiday_pay: number;
}): number {
  return Math.round((entry.base_pay + entry.bonuses + entry.tips + entry.holiday_pay - entry.deductions) * 100) / 100;
}
