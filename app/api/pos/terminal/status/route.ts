import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

// Polls a Terminal PaymentIntent for its outcome. Response vocabulary matches
// what components/pos/PaymentModal.tsx's polling loop expects:
// "succeeded" / "canceled" / "requires_payment_method" (+ a `declined` flag
// that distinguishes "card was rejected" from "still waiting for the tap").
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const piId = req.nextUrl.searchParams.get("payment_intent_id");
  if (!piId) {
    return NextResponse.json({ error: "payment_intent_id is required" }, { status: 400 });
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(piId);

    if (pi.status === "succeeded") {
      return NextResponse.json({
        status: "succeeded",
        amount_received: (pi.amount_received ?? 0) / 100,
        declined: false,
        error_message: null,
      });
    }
    if (pi.status === "canceled") {
      return NextResponse.json({ status: "canceled", amount_received: 0, declined: false, error_message: null });
    }

    // requires_payment_method: either still waiting for the customer to
    // tap/insert, or the last attempt was declined (last_payment_error set).
    const declined = !!pi.last_payment_error;
    return NextResponse.json({
      status: "requires_payment_method",
      amount_received: 0,
      declined,
      error_message: declined ? (pi.last_payment_error?.message || "Card declined") : null,
    });
  } catch (error) {
    console.error("Terminal status check error:", error);
    return NextResponse.json({ error: "Failed to check payment status" }, { status: 500 });
  }
}
