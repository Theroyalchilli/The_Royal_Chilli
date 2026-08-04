import supabase from "@/lib/supabase";

export function weekDates(weekStart: string): string[] {
  const start = new Date(weekStart + "T00:00:00Z");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export async function checkConflicts(staffId: number, dateStr: string): Promise<string[]> {
  const conflicts: string[] = [];
  const dayOfWeek = new Date(dateStr + "T00:00:00Z").getUTCDay();

  const { data: availability } = await supabase
    .from("staff_availability")
    .select("is_available")
    .eq("staff_id", staffId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();
  if (availability && availability.is_available === 0) {
    conflicts.push("This employee marked themselves unavailable on this day of the week.");
  }

  const { data: leave } = await supabase
    .from("leave_requests")
    .select("leave_type, status")
    .eq("staff_id", staffId)
    .lte("start_date", dateStr)
    .gte("end_date", dateStr)
    .in("status", ["pending", "approved"]);
  for (const l of leave || []) {
    conflicts.push(`Employee has ${l.status} ${l.leave_type} leave covering this date.`);
  }

  const { data: existingShift } = await supabase
    .from("shifts")
    .select("id, start_time, end_time")
    .eq("staff_id", staffId)
    .eq("shift_date", dateStr)
    .neq("status", "cancelled");
  if (existingShift && existingShift.length > 0) {
    conflicts.push(`Employee already has a shift on this date (${existingShift[0].start_time}–${existingShift[0].end_time}).`);
  }

  return conflicts;
}
