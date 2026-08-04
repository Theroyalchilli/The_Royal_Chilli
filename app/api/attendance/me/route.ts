import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { getOpenClockEvent, getOpenBreak } from "@/lib/attendance";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const open = await getOpenClockEvent(session.id);
  const openBreak = open ? await getOpenBreak(open.id) : null;

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: history, error } = await supabase
    .from("clock_events")
    .select("*")
    .eq("staff_id", session.id)
    .gte("clock_in", fourteenDaysAgo)
    .order("clock_in", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });

  return NextResponse.json({ open, openBreak, history });
}
