import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { sumupConfigured, sumupMerchantCode, sumupFetch } from "@/lib/sumup";

type SumUpReaderCheckout = { id: string };

// Pushes a real charge to the restaurant's registered SumUp Solo reader via
// the Cloud API — the in-person equivalent of the website's SumUp Hosted
// Checkout, same account. Returns immediately once the reader has been told
// to start; the client polls /api/pos/terminal/status for the outcome since
// the customer still has to actually tap/insert their card. The response
// shape is kept identical to the old Stripe Terminal route (payment_intent_id
// key) so the client component doesn't need to change.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!sumupConfigured) {
      return NextResponse.json({ error: "SumUp is not configured" }, { status: 503 });
    }

    const { amount } = await req.json();
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
    }

    const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "sumup_reader_id").maybeSingle();
    const readerId = setting ? String(setting.value || "").trim() : "";
    if (!readerId) {
      return NextResponse.json({ error: "No card reader is configured in Settings" }, { status: 400 });
    }

    const checkout = await sumupFetch<SumUpReaderCheckout>(
      `/v0.1/merchants/${sumupMerchantCode}/readers/${readerId}/checkout`,
      {
        method: "POST",
        body: JSON.stringify({
          total_amount: { currency: "GBP", minor_unit: 2, value: Math.round(amountNum * 100) },
        }),
      }
    );

    return NextResponse.json({ payment_intent_id: checkout.id });
  } catch (error) {
    console.error("Terminal charge error:", error);
    const message = error instanceof Error ? error.message : "Failed to start card reader payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
