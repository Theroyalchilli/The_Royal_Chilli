import supabase from "@/lib/supabase";

// Worked hours per staff member for a period, taken directly from live
// attendance punches (closed shifts only — clock_out set) in the shared
// database. No manager "lock" step required: hours are current the moment
// someone clocks out, and a later correction (attendance_corrections) that
// edits the underlying attendance row is reflected immediately too, since
// everything downstream always reads current state rather than a snapshot.
export async function computeHoursForPeriod(
  periodStart: string,
  periodEnd: string,
): Promise<Map<number, number>> {
  const { data: rows, error } = await supabase
    .from("attendance")
    .select("staff_id, net_work_seconds")
    .not("clock_out", "is", null)
    .gte("work_date", periodStart)
    .lte("work_date", periodEnd);
  if (error) throw error;

  const hoursByStaff = new Map<number, number>();
  for (const r of rows ?? []) {
    const netSeconds = Number(r.net_work_seconds ?? 0);
    hoursByStaff.set(r.staff_id, (hoursByStaff.get(r.staff_id) ?? 0) + netSeconds / 3600);
  }
  return hoursByStaff;
}

export function computeGrossPay(entry: {
  base_pay: number; bonuses: number; tips: number; deductions: number; holiday_pay: number;
}): number {
  return Math.round((entry.base_pay + entry.bonuses + entry.tips + entry.holiday_pay - entry.deductions) * 100) / 100;
}
