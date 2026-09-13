import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import supabase from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

// Stripe is the source of truth for "did the payment actually succeed" — the
// browser redirect back to success_url is just a UX hint, never trusted on
// its own. This webhook is what actually marks things paid.
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { type, order_id, reservation_id } = session.metadata || {};

    try {
      if (type === "order" && order_id) {
        // Stripe can redeliver the same event (retries, manual resend) — guard
        // against inserting a second payment row for a session we've already
        // recorded, since there's no DB-level unique constraint on reference.
        const { data: existingPayment } = await supabase
          .from("payments").select("id").eq("order_id", Number(order_id)).eq("reference", session.id).maybeSingle();
        const { data: order } = await supabase.from("orders").select("amount_paid, total").eq("id", order_id).single();
        if (!existingPayment && order && Number(order.amount_paid) < Number(order.total)) {
          const amount = (session.amount_total || 0) / 100;
          await supabase.from("payments").insert({
            order_id: Number(order_id),
            method: "card_online",
            amount,
            staff_id: null,
            reference: session.id,
          });
        }
      } else if (type === "reservation" && reservation_id) {
        await supabase
          .from("reservations")
          .update({ deposit_paid_at: new Date().toISOString() })
          .eq("id", Number(reservation_id))
          .is("deposit_paid_at", null);
      }
    } catch (err) {
      console.error("Stripe webhook processing error:", err);
      // Non-2xx makes Stripe retry delivery — appropriate here since this is
      // likely a transient DB error, not a bad event.
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
