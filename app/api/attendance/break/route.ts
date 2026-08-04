import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { getOpenClockEvent, getOpenBreak } from "@/lib/attendance";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const open = await getOpenClockEvent(session.id);
    if (!open) return NextResponse.json({ error: "You're not clocked in" }, { status: 400 });

    const { action } = await req.json();
    const existingBreak = await getOpenBreak(open.id);

    if (action === "start") {
      if (existingBreak) return NextResponse.json({ error: "Break already in progress" }, { status: 400 });
      const { data, error } = await supabase
        .from("breaks")
        .insert({ clock_event_id: open.id, break_start: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, break: data });
    }

    if (action === "end") {
      if (!existingBreak) return NextResponse.json({ error: "No break in progress" }, { status: 400 });
      const { data, error } = await supabase
        .from("breaks")
        .update({ break_end: new Date().toISOString() })
        .eq("id", existingBreak.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, break: data });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Break toggle error:", error);
    return NextResponse.json({ error: "Failed to update break" }, { status: 500 });
  }
}
