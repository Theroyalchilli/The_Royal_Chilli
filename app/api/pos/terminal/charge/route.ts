import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

// Pushes a real charge to the restaurant's registered card reader — this is
// the in-person equivalent of the website's Stripe Checkout flow, same
// account, same dashboard. Returns immediately once the reader has been told
// to start; the client polls /api/pos/terminal/status for the outcome since
// the customer still has to actually tap/insert their card.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const { amount } = await req.json();
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
    }

    const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "stripe_terminal_reader_id").maybeSingle();
    const readerId = setting ? String(setting.value || "").trim() : "";
    if (!readerId) {
      return NextResponse.json({ error: "No card reader is configured in Settings" }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountNum * 100),
      currency: "gbp",
      payment_method_types: ["card_present"],
      capture_method: "automatic",
    });

    await stripe.terminal.readers.processPaymentIntent(readerId, { payment_intent: paymentIntent.id });

    return NextResponse.json({ payment_intent_id: paymentIntent.id });
  } catch (error) {
    console.error("Terminal charge error:", error);
    const message = error instanceof Error ? error.message : "Failed to start card reader payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
