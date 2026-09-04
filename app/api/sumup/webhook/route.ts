import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { sumupFetch, sumupConfigured } from "@/lib/sumup";

type SumUpCheckout = { id: string; status: string; amount: number; checkout_reference: string };

// SumUp's own docs are explicit that the webhook payload itself must not be
// trusted — it's just a "something changed, go check" nudge (event_type
// CHECKOUT_STATUS_CHANGED + the checkout id). Unlike Stripe's webhook, which
// verifies a signature over a payload that already contains the trusted
// data, this route re-fetches the checkout via our own authenticated API
// key before acting — that authenticated re-fetch, not the incoming
// request, is the actual trust boundary here.
export async function POST(req: NextRequest) {
  if (!sumupConfigured) {
    return NextResponse.json({ error: "SumUp not configured" }, { status: 503 });
  }

  let checkoutId: string | undefined;
  try {
    const body = await req.json();
    checkoutId = body?.id || body?.checkout_id || body?.payload?.id;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!checkoutId) {
    return NextResponse.json({ error: "Missing checkout id" }, { status: 400 });
  }

  try {
    const checkout = await sumupFetch<SumUpCheckout>(`/v0.1/checkouts/${checkoutId}`);
    if (checkout.status !== "PAID") {
      return NextResponse.json({ received: true });
    }

    const [type, refId] = (checkout.checkout_reference || "").split(":");

    if (type === "order" && refId) {
      const { data: order } = await supabase.from("orders").select("amount_paid, total").eq("id", refId).single();
      if (order && Number(order.amount_paid) < Number(order.total)) {
        await supabase.from("payments").insert({
          order_id: Number(refId),
          method: "card_online",
          amount: checkout.amount,
          staff_id: null,
          reference: checkout.id,
        });
      }
    } else if (type === "reservation" && refId) {
      await supabase
        .from("reservations")
        .update({ deposit_paid_at: new Date().toISOString() })
        .eq("id", Number(refId))
        .is("deposit_paid_at", null);
    }
  } catch (err) {
    console.error("SumUp webhook processing error:", err);
    // Non-2xx should make SumUp retry delivery — appropriate here since this
    // is likely a transient DB/API error, not a bad event.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
