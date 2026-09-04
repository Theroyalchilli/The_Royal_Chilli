import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { sumupConfigured, sumupMerchantCode, sumupFetch } from "@/lib/sumup";

// Lets staff back out of an in-progress reader charge (e.g. customer changed
// their mind, or the reader is stuck) without leaving it hanging. SumUp only
// allows this while the reader is still waiting for card/PIN input.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!sumupConfigured) {
      return NextResponse.json({ error: "SumUp is not configured" }, { status: 503 });
    }

    const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "sumup_reader_id").maybeSingle();
    const readerId = setting ? String(setting.value || "").trim() : "";
    if (!readerId) {
      return NextResponse.json({ error: "No card reader is configured" }, { status: 400 });
    }

    await sumupFetch(`/v0.1/merchants/${sumupMerchantCode}/readers/${readerId}/terminate`, { method: "POST" });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Terminal cancel error:", error);
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
}
