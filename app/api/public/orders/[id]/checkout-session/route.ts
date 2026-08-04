import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { stripe, siteUrl } from "@/lib/stripe";

// Creates a Stripe Checkout Session for an already-created order (from
// POST /api/public/orders) so the customer can pay online instead of at
// collection/delivery. The order itself is unchanged either way — this just
// gives the option of settling it before it's even sent to the kitchen.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Online payment is not configured yet" }, { status: 503 });
    }

    const { id } = await params;
    const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (Number(order.amount_paid) >= Number(order.total)) {
      return NextResponse.json({ error: "This order is already paid" }, { status: 400 });
    }

    const remaining = Math.round((Number(order.total) - Number(order.amount_paid)) * 100) / 100;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(remaining * 100),
            product_data: { name: `The Royal Chilli — Order ${order.order_number}` },
          },
          quantity: 1,
        },
      ],
      customer_email: order.customer_email || undefined,
      metadata: { type: "order", order_id: String(order.id) },
      success_url: `${siteUrl()}/order/confirmation?order_id=${order.id}`,
      cancel_url: `${siteUrl()}/order/checkout?payment=cancelled`,
    });

    await supabase.from("orders").update({ stripe_session_id: session.id }).eq("id", id);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout session create error:", error);
    return NextResponse.json({ error: "Failed to start online payment" }, { status: 500 });
  }
}
