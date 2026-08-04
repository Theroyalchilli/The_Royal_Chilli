import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const staffIdParam = searchParams.get("staff_id");
  const staffId = staffIdParam ? Number(staffIdParam) : session.id;

  if (staffId !== session.id && !canManageStaff(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("staff_availability")
    .select("day_of_week, is_available, notes")
    .eq("staff_id", staffId);
  if (error) return NextResponse.json({ error: "Failed to fetch availability" }, { status: 500 });

  // Default every day to available if no row exists yet.
  const byDay = new Map((data || []).map((d) => [d.day_of_week, d]));
  const days = Array.from({ length: 7 }, (_, i) => byDay.get(i) || { day_of_week: i, is_available: 1, notes: null });

  return NextResponse.json({ days });
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { staff_id, days } = await req.json();
    const targetStaffId = staff_id ?? session.id;
    if (targetStaffId !== session.id && !canManageStaff(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!Array.isArray(days)) {
      return NextResponse.json({ error: "days array is required" }, { status: 400 });
    }

    const rows = days.map((d: { day_of_week: number; is_available: number; notes?: string }) => ({
      staff_id: targetStaffId,
      day_of_week: d.day_of_week,
      is_available: d.is_available,
      notes: d.notes || null,
    }));

    const { error } = await supabase.from("staff_availability").upsert(rows, { onConflict: "staff_id,day_of_week" });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Availability update error:", error);
    return NextResponse.json({ error: "Failed to update availability" }, { status: 500 });
  }
}
