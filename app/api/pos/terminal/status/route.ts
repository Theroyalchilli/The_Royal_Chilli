import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const paymentIntentId = req.nextUrl.searchParams.get("payment_intent_id");
  if (!paymentIntentId) {
    return NextResponse.json({ error: "payment_intent_id is required" }, { status: 400 });
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    // requires_payment_method is also the PaymentIntent's starting state before
    // any card has been presented — only last_payment_error being set means an
    // actual attempt was made and declined, not just "still waiting for a tap".
    return NextResponse.json({
      status: pi.status,
      amount_received: pi.amount_received / 100,
      declined: !!pi.last_payment_error,
      error_message: pi.last_payment_error?.message || null,
    });
  } catch (error) {
    console.error("Terminal status check error:", error);
    return NextResponse.json({ error: "Failed to check payment status" }, { status: 500 });
  }
}
