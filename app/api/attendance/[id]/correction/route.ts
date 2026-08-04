import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";

// An employee requests a fix to a past clock event (e.g. forgot to clock out).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { data: event } = await supabase.from("clock_events").select("staff_id").eq("id", id).single();
    if (!event || event.staff_id !== session.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { requested_clock_in, requested_clock_out, reason } = await req.json();
    if (!reason) return NextResponse.json({ error: "A reason is required" }, { status: 400 });

    const { data, error } = await supabase
      .from("clock_events")
      .update({
        correction_status: "pending",
        correction_reason: reason,
        requested_clock_in: requested_clock_in || null,
        requested_clock_out: requested_clock_out || null,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, clockEvent: data });
  } catch (error) {
    console.error("Correction request error:", error);
    return NextResponse.json({ error: "Failed to submit correction request" }, { status: 500 });
  }
}

// A manager approves or rejects it.
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
    const { decision } = await req.json(); // 'approved' | 'rejected'
    if (decision !== "approved" && decision !== "rejected") {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      correction_status: decision,
      approved_by: session.id,
      approved_at: new Date().toISOString(),
    };

    if (decision === "approved") {
      const { data: event } = await supabase
        .from("clock_events")
        .select("requested_clock_in, requested_clock_out")
        .eq("id", id)
        .single();
      if (event?.requested_clock_in) updates.clock_in = event.requested_clock_in;
      if (event?.requested_clock_out) {
        updates.clock_out = event.requested_clock_out;
        updates.status = "closed";
      }
    }

    const { data, error } = await supabase
      .from("clock_events")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, clockEvent: data });
  } catch (error) {
    console.error("Correction decision error:", error);
    return NextResponse.json({ error: "Failed to record decision" }, { status: 500 });
  }
}
