import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";
import { weekDates } from "@/lib/rota";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageStaff(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { from_week_start, to_week_start } = await req.json();
    if (!from_week_start || !to_week_start) {
      return NextResponse.json({ error: "from_week_start and to_week_start are required" }, { status: 400 });
    }

    const fromDates = weekDates(from_week_start);
    const toDates = weekDates(to_week_start);

    const { data: sourceShifts, error: fetchErr } = await supabase
      .from("shifts")
      .select("staff_id, shift_date, start_time, end_time, position, notes")
      .gte("shift_date", fromDates[0])
      .lte("shift_date", fromDates[6])
      .neq("status", "cancelled");
    if (fetchErr) throw fetchErr;

    if (!sourceShifts || sourceShifts.length === 0) {
      return NextResponse.json({ success: true, copied: 0 });
    }

    // Preserve day-of-week offset: source day index -> same index in target week.
    const dayIndex = new Map(fromDates.map((d, i) => [d, i]));
    const newShifts = sourceShifts.map((s) => ({
      staff_id: s.staff_id,
      shift_date: toDates[dayIndex.get(s.shift_date) ?? 0],
      start_time: s.start_time,
      end_time: s.end_time,
      position: s.position,
      notes: s.notes,
      created_by: session.id,
    }));

    // Skip any that would collide with an existing shift for that staff/date in the target week.
    const { data: existing } = await supabase
      .from("shifts")
      .select("staff_id, shift_date")
      .gte("shift_date", toDates[0])
      .lte("shift_date", toDates[6])
      .neq("status", "cancelled");
    const existingKeys = new Set((existing || []).map((e) => `${e.staff_id}_${e.shift_date}`));
    const toInsert = newShifts.filter((s) => !existingKeys.has(`${s.staff_id}_${s.shift_date}`));

    if (toInsert.length === 0) {
      return NextResponse.json({ success: true, copied: 0, skipped: newShifts.length });
    }

    const { error: insertErr } = await supabase.from("shifts").insert(toInsert);
    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true, copied: toInsert.length, skipped: newShifts.length - toInsert.length });
  } catch (error) {
    console.error("Copy week error:", error);
    return NextResponse.json({ error: "Failed to copy week" }, { status: 500 });
  }
}
