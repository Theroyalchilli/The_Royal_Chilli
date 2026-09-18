import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm } from "@/lib/permissions";
import { recalcTotals } from "@/lib/order-totals";
import { getCashCreditInfo } from "@/lib/loyalty";

// One-tap "use my points" at the till — no code, no Staff Hub trip. Only
// ever offered in fixed £-cap chunks (see getCashCreditInfo): a balance
// worth less than the cap isn't redeemable yet, and only one chunk applies
// per transaction even if the balance is worth more. Same discount
// mechanism as a code redemption or a manager discount — replaces rather
// than stacks with any existing discount on the order.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canViewCrm(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { customer_id, order_id } = await req.json();
    if (!customer_id || !order_id) return NextResponse.json({ error: "customer_id and order_id are required" }, { status: 400 });

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status === "paid" || order.status === "cancelled") {
      return NextResponse.json({ error: "This order can no longer be changed" }, { status: 409 });
    }

    // Guard against double-tapping the button (or a retried request) — never
    // debit twice for the same order.
    const { data: existing } = await supabase
      .from("loyalty_transactions")
      .select("id")
      .eq("reference_type", "cash_credit")
      .eq("reference_id", order_id)
      .limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "Loyalty credit has already been applied to this order" }, { status: 400 });
    }

    const { data: customer } = await supabase.from("customers").select("loyalty_points").eq("id", customer_id).single();
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const cashCredit = await getCashCreditInfo(customer.loyalty_points);
    if (!cashCredit.eligible) {
      return NextResponse.json(
        { error: `Not enough points yet — needs £${(cashCredit.cap - cashCredit.convertedValue).toFixed(2)} more` },
        { status: 400 }
      );
    }

    const { error: ledgerErr } = await supabase.from("loyalty_transactions").insert({
      customer_id,
      points_delta: -cashCredit.redeemPoints,
      reason: "redeemed_reward",
      reference_type: "cash_credit",
      reference_id: order_id,
      staff_id: session.id,
    });
    if (ledgerErr) throw ledgerErr;

    await supabase
      .from("orders")
      .update({
        discount_type: "amount",
        discount_pct: null,
        discount: cashCredit.redeemAmount,
        discount_reason: "Loyalty credit",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id);
    const bill = await recalcTotals(String(order_id));

    return NextResponse.json({ success: true, amount: cashCredit.redeemAmount, points_spent: cashCredit.redeemPoints, bill });
  } catch (error) {
    console.error("Cash-credit redeem error:", error);
    return NextResponse.json({ error: "Failed to apply loyalty credit" }, { status: 500 });
  }
}
