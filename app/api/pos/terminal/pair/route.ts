import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";
import { stripe, TERMINAL_LOCATION_ADDRESS } from "@/lib/stripe";

type PairedReader = { id: string; label: string | null; status: string | null };

// One-time setup: registers a physical Stripe Terminal reader to this account.
// Stripe requires every reader to belong to a Terminal "Location", so this
// lazily creates one (from the fixed premises address in lib/stripe.ts) the
// first time and reuses its id after. The registration_code is shown ON THE
// READER during its pairing flow and is single-use / short-lived, so this
// runs while someone is standing at the device. The returned id goes into the
// "Card Reader ID" field in Settings.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageStaff(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const { registration_code, label } = await req.json();
    if (!registration_code || !label) {
      return NextResponse.json({ error: "registration_code and label are required" }, { status: 400 });
    }

    // --- ensure a Terminal Location exists ---
    const { data: locSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "stripe_terminal_location_id")
      .maybeSingle();
    let locationId = locSetting ? String(locSetting.value || "").trim() : "";

    if (!locationId) {
      const location = await stripe.terminal.locations.create({
        display_name: "The Royal Chilli",
        address: { ...TERMINAL_LOCATION_ADDRESS },
      });
      locationId = location.id;
      await supabase
        .from("app_settings")
        .upsert({ key: "stripe_terminal_location_id", value: locationId, updated_at: new Date().toISOString() }, { onConflict: "key" });
    }

    const reader = await stripe.terminal.readers.create({
      registration_code: String(registration_code).trim(),
      label: String(label).trim(),
      location: locationId,
    });

    const paired: PairedReader = { id: reader.id, label: reader.label, status: reader.status };
    return NextResponse.json({ reader: paired });
  } catch (error) {
    console.error("Reader pairing error:", error);
    const message = error instanceof Error ? error.message : "Failed to pair reader";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
