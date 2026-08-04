import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { getOpenClockEvent, findTodaysShiftAndLateness } from "@/lib/attendance";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await getOpenClockEvent(session.id);
    if (existing) {
      return NextResponse.json({ error: "You're already clocked in" }, { status: 400 });
    }

    const now = new Date();
    const { shiftId, lateMinutes } = await findTodaysShiftAndLateness(session.id, now);

    const { data, error } = await supabase
      .from("clock_events")
      .insert({
        staff_id: session.id,
        shift_id: shiftId,
        clock_in: now.toISOString(),
        status: "open",
        late_minutes: lateMinutes,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, clockEvent: data }, { status: 201 });
  } catch (error) {
    console.error("Clock-in error:", error);
    return NextResponse.json({ error: "Failed to clock in" }, { status: 500 });
  }
}
