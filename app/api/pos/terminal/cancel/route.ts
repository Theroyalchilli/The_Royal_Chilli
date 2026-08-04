import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

// Lets staff back out of an in-progress reader charge (e.g. customer changed
// their mind, or the reader is stuck) without leaving it hanging.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "stripe_terminal_reader_id").maybeSingle();
    const readerId = setting ? String(setting.value || "").trim() : "";
    if (!readerId) {
      return NextResponse.json({ error: "No card reader is configured" }, { status: 400 });
    }

    await stripe.terminal.readers.cancelAction(readerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Terminal cancel error:", error);
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
}
