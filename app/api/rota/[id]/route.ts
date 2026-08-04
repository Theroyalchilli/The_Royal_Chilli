import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageStaff(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const { start_time, end_time, position, notes, status } = await req.json();

    const updates: Record<string, unknown> = {};
    if (start_time) updates.start_time = start_time;
    if (end_time) updates.end_time = end_time;
    if (position !== undefined) updates.position = position;
    if (notes !== undefined) updates.notes = notes;
    if (status) updates.status = status;

    const { data, error } = await supabase.from("shifts").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, shift: data });
  } catch (error) {
    console.error("Shift update error:", error);
    return NextResponse.json({ error: "Failed to update shift" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageStaff(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const { error } = await supabase.from("shifts").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shift delete error:", error);
    return NextResponse.json({ error: "Failed to delete shift (it may already have attendance recorded against it)" }, { status: 500 });
  }
}
