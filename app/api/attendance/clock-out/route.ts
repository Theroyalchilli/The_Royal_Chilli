import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { getOpenClockEvent, getOpenBreak } from "@/lib/attendance";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const open = await getOpenClockEvent(session.id);
    if (!open) {
      return NextResponse.json({ error: "You're not clocked in" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Auto-close a forgotten open break so clock-out always leaves a clean record.
    const openBreak = await getOpenBreak(open.id);
    if (openBreak) {
      await supabase.from("breaks").update({ break_end: now }).eq("id", openBreak.id);
    }

    const { data, error } = await supabase
      .from("clock_events")
      .update({ clock_out: now, status: "closed" })
      .eq("id", open.id)
      .select()
      .single();
    if (error) throw error;

    if (open.shift_id) {
      await supabase.from("shifts").update({ status: "completed" }).eq("id", open.shift_id);
    }

    return NextResponse.json({ success: true, clockEvent: data });
  } catch (error) {
    console.error("Clock-out error:", error);
    return NextResponse.json({ error: "Failed to clock out" }, { status: 500 });
  }
}
