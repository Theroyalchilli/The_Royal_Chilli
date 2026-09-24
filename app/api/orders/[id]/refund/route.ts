import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

// A refund is just another row in `payments`, with a negative amount — same
// pattern as a normal payment, so the existing trigger that keeps
// orders.amount_paid in sync handles it for free. Deliberately never touches
// orders.status: even a partially-refunded order stays `paid` — it's a
// financial correction, often happening long after the customer's left, and
// reverting status could wrongly re-trigger table/kitchen-facing logic.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { amount, method, reason } = await req.json().catch(() => ({}));

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Refund amount is required" }, { status: 400 });
    }
    if (!method || !["cash", "card", "card_online"].includes(method)) {
      return NextResponse.json({ error: "A valid refund method is required" }, { status: 400 });
    }
    if (!reason || !String(reason).trim()) {
      return NextResponse.json({ error: "A reason is required" }, { status: 400 });
    }

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, total, amount_paid, customer_id")
      .eq("id", id)
      .single();
    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const requestedAmount = Math.round(Number(amount) * 100) / 100;
    if (requestedAmount > Number(order.amount_paid) + 0.01) {
      return NextResponse.json(
        { error: `Cannot refund more than the £${Number(order.amount_paid).toFixed(2)} paid` },
        { status: 400 }
      );
    }

    // Card and online refunds move real money — never record anything in our
    // own ledger unless Stripe actually confirms it, so "Refund" here can
    // never say yes while the customer's card still hasn't been credited.
    // Cash needs no such check: staff physically hand it back from the till.
    let refundAmount = requestedAmount;
    let stripeRefundIds: string[] = [];
    let shortfall = 0;
    if (method === "card" || method === "card_online") {
      const result = await refundViaStripe(Number(id), method, requestedAmount);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }
      refundAmount = result.refundedAmount;
      stripeRefundIds = result.refundIds;
      shortfall = result.shortfall;
    }

    const { error: insertError } = await supabase.from("payments").insert({
      order_id: Number(id),
      method,
      amount: -refundAmount,
      staff_id: session.id,
      reference: stripeRefundIds.length > 0 ? `Refund: ${String(reason).trim()} (Stripe: ${stripeRefundIds.join(", ")})` : `Refund: ${String(reason).trim()}`,
    });
    if (insertError) throw insertError;

    if (order.customer_id) {
      await reverseLoyaltyPointsForRefund(Number(id), order.customer_id, refundAmount, Number(order.total));
    }

    const { data: refreshed } = await supabase.from("orders").select("total, amount_paid").eq("id", id).single();

    return NextResponse.json({
      success: true,
      amount_paid: refreshed?.amount_paid ?? null,
      refunded_amount: refundAmount,
      warning:
        shortfall > 0
          ? `Refunded £${refundAmount.toFixed(2)} via Stripe. £${shortfall.toFixed(2)} of the requested amount couldn't be matched to a Stripe payment — refund that portion manually and record it here separately.`
          : undefined,
    });
  } catch (error) {
    console.error("Refund error:", error);
    return NextResponse.json({ error: "Failed to process refund" }, { status: 500 });
  }
}

// Actually moves the money back, against the real Stripe payment(s) behind
// this order — using the PaymentIntent id already stored on `payments`
// (directly, for a Terminal card-present payment; via the Checkout Session
// id, for an online payment). Spreads the requested amount across however
// many same-method payments exist on the order (almost always exactly one),
// oldest first, stopping the moment a refund attempt fails so a bad payment
// never blocks the ones before it. Any amount left over after that is
// reported back as a shortfall rather than silently dropped or over-claimed.
async function refundViaStripe(
  orderId: number,
  method: "card" | "card_online",
  amount: number
): Promise<{ ok: true; refundedAmount: number; refundIds: string[]; shortfall: number } | { ok: false; error: string }> {
  if (!stripe) {
    return { ok: false, error: "Stripe isn't configured — this refund can't be processed automatically. Issue it directly in the Stripe Dashboard, then record what happened here as a note." };
  }

  const { data: originals } = await supabase
    .from("payments")
    .select("amount, reference")
    .eq("order_id", orderId)
    .eq("method", method)
    .gt("amount", 0)
    .order("created_at", { ascending: true });

  if (!originals || originals.length === 0) {
    return { ok: false, error: `No ${method === "card" ? "card" : "online card"} payment was found on this order to refund against.` };
  }

  let remainingPence = Math.round(amount * 100);
  let refundedPence = 0;
  const refundIds: string[] = [];

  for (const p of originals) {
    if (remainingPence <= 0) break;
    if (!p.reference) continue;

    let paymentIntentId = p.reference;
    if (method === "card_online") {
      try {
        const checkoutSession = await stripe.checkout.sessions.retrieve(p.reference);
        if (!checkoutSession.payment_intent) continue;
        paymentIntentId = typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : checkoutSession.payment_intent.id;
      } catch {
        continue;
      }
    }

    const portion = Math.min(remainingPence, Math.round(Number(p.amount) * 100));
    try {
      const refund = await stripe.refunds.create({ payment_intent: paymentIntentId, amount: portion });
      refundIds.push(refund.id);
      refundedPence += portion;
      remainingPence -= portion;
    } catch (err) {
      console.error("Stripe refund failed for payment_intent", paymentIntentId, err);
      break;
    }
  }

  if (refundedPence === 0) {
    return { ok: false, error: "Stripe refused the refund — the card payment may already be fully refunded, or its record has gone stale. Check the Stripe Dashboard directly." };
  }

  return { ok: true, refundedAmount: refundedPence / 100, refundIds, shortfall: remainingPence / 100 };
}

// Reverses the proportional share of points this order originally earned —
// a £10 refund on a £100 order reverses 10% of the points that order's
// earned_purchase/tier_bonus rows awarded. Tracks cumulative reversals
// against the order (via prior refund_reversal rows) so several partial
// refunds on the same order can never over-reverse it, and caps at the
// customer's current balance so it can never go negative. Never touches or
// deletes the original earning rows — this is a separate ledger entry.
async function reverseLoyaltyPointsForRefund(orderId: number, customerId: number, refundAmount: number, orderTotal: number) {
  if (orderTotal <= 0) return;

  const { data: earnRows } = await supabase
    .from("loyalty_transactions")
    .select("points_delta")
    .eq("reference_type", "order")
    .eq("reference_id", orderId)
    .in("reason", ["earned_purchase", "tier_bonus"]);
  const originalEarned = (earnRows || []).reduce((s, r) => s + Number(r.points_delta), 0);
  if (originalEarned <= 0) return;

  const { data: priorReversals } = await supabase
    .from("loyalty_transactions")
    .select("points_delta")
    .eq("reference_type", "order")
    .eq("reference_id", orderId)
    .eq("reason", "refund_reversal");
  const alreadyReversed = Math.abs((priorReversals || []).reduce((s, r) => s + Number(r.points_delta), 0));
  const remainingReversible = Math.max(0, originalEarned - alreadyReversed);
  if (remainingReversible <= 0) return;

  const refundFraction = Math.min(1, refundAmount / orderTotal);
  let reversalAmount = Math.floor(originalEarned * refundFraction);
  reversalAmount = Math.min(reversalAmount, remainingReversible);

  const { data: customer } = await supabase.from("customers").select("loyalty_points").eq("id", customerId).single();
  reversalAmount = Math.min(reversalAmount, Math.max(0, Number(customer?.loyalty_points ?? 0)));
  if (reversalAmount <= 0) return;

  await supabase.from("loyalty_transactions").insert({
    customer_id: customerId,
    points_delta: -reversalAmount,
    reason: "refund_reversal",
    reference_type: "order",
    reference_id: orderId,
  });
}
