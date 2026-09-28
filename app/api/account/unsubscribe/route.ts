import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { unsubscribeKeyValid } from "@/lib/unsubscribe";

// POST { c, k } — from the signed link in a marketing email: stop offers /
// rewards emails. (Order and account emails still go.)
export async function POST(req: NextRequest) {
  const { c, k } = await req.json().catch(() => ({}));
  const customerId = Number(c);
  if (!unsubscribeKeyValid(customerId, String(k || ""))) {
    return NextResponse.json({ error: "This unsubscribe link isn't valid" }, { status: 400 });
  }
  const { error } = await supabase.from("customers").update({ marketing_consent: false }).eq("id", customerId);
  if (error) return NextResponse.json({ error: "Couldn't update your preferences — please try again" }, { status: 500 });
  return NextResponse.json({ success: true });
}
