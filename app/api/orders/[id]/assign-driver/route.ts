import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageDrivers } from "@/lib/permissions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageDrivers(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const { driver_id } = await req.json();
    if (!driver_id) return NextResponse.json({ error: "driver_id is required" }, { status: 400 });

    const { data: driver } = await supabase.from("staff").select("id, role").eq("id", driver_id).single();
    if (!driver || driver.role !== "driver") {
      return NextResponse.json({ error: "That staff member is not a driver" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ driver_id, delivery_status: "assigned", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, order: data });
  } catch (error) {
    console.error("Assign driver error:", error);
    return NextResponse.json({ error: "Failed to assign driver" }, { status: 500 });
  }
}
