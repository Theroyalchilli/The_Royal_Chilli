import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

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

    const refundAmount = Math.round(Number(amount) * 100) / 100;
    if (refundAmount > Number(order.amount_paid) + 0.01) {
      return NextResponse.json(
        { error: `Cannot refund more than the £${Number(order.amount_paid).toFixed(2)} paid` },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase.from("payments").insert({
      order_id: Number(id),
      method,
      amount: -refundAmount,
      staff_id: session.id,
      reference: `Refund: ${String(reason).trim()}`,
    });
    if (insertError) throw insertError;

    if (order.customer_id) {
      await reverseLoyaltyPointsForRefund(Number(id), order.customer_id, refundAmount, Number(order.total));
    }

    const { data: refreshed } = await supabase.from("orders").select("total, amount_paid").eq("id", id).single();

    return NextResponse.json({ success: true, amount_paid: refreshed?.amount_paid ?? null });
  } catch (error) {
    console.error("Refund error:", error);
    return NextResponse.json({ error: "Failed to process refund" }, { status: 500 });
  }
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
