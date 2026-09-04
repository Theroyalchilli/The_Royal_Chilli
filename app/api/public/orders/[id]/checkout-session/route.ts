import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { sumupConfigured, sumupMerchantCode, sumupFetch, siteUrl } from "@/lib/sumup";

type SumUpCheckout = { id: string; hosted_checkout_url: string };

// Creates a SumUp Hosted Checkout for an already-created order (from
// POST /api/public/orders) so the customer can pay online instead of at
// collection/delivery. The order itself is unchanged either way — this just
// gives the option of settling it before it's even sent to the kitchen.
//
// checkout_reference encodes type + id ("order:123") since SumUp's checkout
// object has no generic metadata field the way Stripe's does — the webhook
// parses this same string back out to know what to mark paid.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!sumupConfigured) {
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

    const checkout = await sumupFetch<SumUpCheckout>("/v0.1/checkouts", {
      method: "POST",
      body: JSON.stringify({
        amount: remaining,
        currency: "GBP",
        merchant_code: sumupMerchantCode,
        checkout_reference: `order:${order.id}`,
        description: `The Royal Chilli — Order ${order.order_number}`,
        redirect_url: `${siteUrl()}/order/confirmation?order_id=${order.id}`,
        hosted_checkout: { enabled: true },
      }),
    });

    await supabase.from("orders").update({ sumup_checkout_id: checkout.id }).eq("id", id);

    return NextResponse.json({ url: checkout.hosted_checkout_url });
  } catch (error) {
    console.error("Checkout session create error:", error);
    return NextResponse.json({ error: "Failed to start online payment" }, { status: 500 });
  }
}
