import supabase from "@/lib/supabase";

export async function getOpenClockEvent(staffId: number) {
  const { data, error } = await supabase
    .from("clock_events")
    .select("*")
    .eq("staff_id", staffId)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getOpenBreak(clockEventId: number) {
  const { data, error } = await supabase
    .from("breaks")
    .select("*")
    .eq("clock_event_id", clockEventId)
    .is("break_end", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Matches today's scheduled shift (if any) and returns how many minutes late clock-in was.
export async function findTodaysShiftAndLateness(staffId: number, clockInAt: Date) {
  const dateStr = clockInAt.toISOString().slice(0, 10);
  const { data: shift } = await supabase
    .from("shifts")
    .select("id, start_time")
    .eq("staff_id", staffId)
    .eq("shift_date", dateStr)
    .eq("status", "scheduled")
    .order("start_time")
    .limit(1)
    .maybeSingle();

  if (!shift) return { shiftId: null, lateMinutes: 0 };

  const [h, m] = shift.start_time.split(":").map(Number);
  const scheduledStart = new Date(clockInAt);
  scheduledStart.setHours(h, m, 0, 0);

  const lateMs = clockInAt.getTime() - scheduledStart.getTime();
  const lateMinutes = lateMs > 60_000 ? Math.round(lateMs / 60000) : 0; // >1 min grace
  return { shiftId: shift.id, lateMinutes };
}
