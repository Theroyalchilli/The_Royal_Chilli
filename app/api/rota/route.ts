import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";
import { weekDates, checkConflicts } from "@/lib/rota";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get("week_start");
  if (!weekStart) return NextResponse.json({ error: "week_start is required" }, { status: 400 });

  const dates = weekDates(weekStart);
  const isManager = canManageStaff(session.role);

  let shiftsQuery = supabase
    .from("shifts")
    .select("*, staff:staff!shifts_staff_id_fkey(name)")
    .gte("shift_date", dates[0])
    .lte("shift_date", dates[6])
    .order("shift_date")
    .order("start_time");
  if (!isManager) shiftsQuery = shiftsQuery.eq("staff_id", session.id);

  const { data: shifts, error } = await shiftsQuery;
  if (error) {
    console.error("Rota fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch rota" }, { status: 500 });
  }
  const flatShifts = (shifts || []).map((s) => {
    const { staff: st, ...rest } = s as typeof s & { staff: { name: string } | null };
    return { ...rest, staff_name: st?.name ?? null };
  });

  let staffList: { id: number; name: string; role: string }[] = [];
  if (isManager) {
    const { data } = await supabase.from("staff").select("id, name, role").eq("active", 1).order("name");
    staffList = data || [];
  }

  return NextResponse.json({ dates, shifts: flatShifts, staff: staffList });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageStaff(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { staff_id, shift_date, start_time, end_time, position, notes, force } = await req.json();
    if (!staff_id || !shift_date || !start_time || !end_time) {
      return NextResponse.json({ error: "staff_id, shift_date, start_time and end_time are required" }, { status: 400 });
    }

    if (!force) {
      const conflicts = await checkConflicts(staff_id, shift_date);
      if (conflicts.length > 0) {
        return NextResponse.json({ conflicts }, { status: 409 });
      }
    }

    const { data, error } = await supabase
      .from("shifts")
      .insert({ staff_id, shift_date, start_time, end_time, position: position || null, notes: notes || null, created_by: session.id })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, shift: data }, { status: 201 });
  } catch (error) {
    console.error("Shift create error:", error);
    return NextResponse.json({ error: "Failed to create shift" }, { status: 500 });
  }
}
