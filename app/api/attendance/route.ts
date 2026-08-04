import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";

// Manager view across all staff, optionally filtered by date range / staff / pending corrections only.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageStaff(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const staffId = searchParams.get("staff_id");
  const pendingOnly = searchParams.get("pending_only") === "1";

  // clock_events has two FKs to staff (staff_id, approved_by) — must name the FK to disambiguate the embed.
  let query = supabase
    .from("clock_events")
    .select("*, staff:staff!clock_events_staff_id_fkey(name)")
    .order("clock_in", { ascending: false });

  if (from) query = query.gte("clock_in", from);
  if (to) query = query.lte("clock_in", to);
  if (staffId) query = query.eq("staff_id", Number(staffId));
  if (pendingOnly) query = query.eq("correction_status", "pending");

  const { data, error } = await query;
  if (error) {
    console.error("Attendance fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }

  const flat = (data || []).map((r) => {
    const { staff: s, ...rest } = r as typeof r & { staff: { name: string } | null };
    return { ...rest, staff_name: s?.name ?? null };
  });

  return NextResponse.json({ clockEvents: flat });
}
