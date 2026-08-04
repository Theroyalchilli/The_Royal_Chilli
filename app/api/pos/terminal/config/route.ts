import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

// Any staff taking payments needs to know whether a card reader is set up —
// deliberately doesn't expose the reader id itself, just whether one exists.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase.from("app_settings").select("value").eq("key", "stripe_terminal_reader_id").maybeSingle();
  const readerId = data ? String(data.value || "") : "";
  return NextResponse.json({ enabled: readerId.trim().length > 0 });
}
