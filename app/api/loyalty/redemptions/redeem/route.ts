import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm } from "@/lib/permissions";
import { recalcTotals } from "@/lib/order-totals";

// Applies an issued redemption to a specific order at the till. A reward
// with a £ discount_amount reduces the order's discount (same field/flow a
// manager discount uses — this replaces rather than stacks with an existing
// discount, same as that endpoint); a reward with no discount_amount (e.g.
// "free soft drink") just gets marked redeemed — staff hand over the item.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canViewCrm(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { code, order_id } = await req.json();
    if (!code || !order_id) return NextResponse.json({ error: "code and order_id are required" }, { status: 400 });

    const { data: redemption, error: fetchErr } = await supabase
      .from("loyalty_redemptions")
      .select("*, reward:loyalty_rewards(name, discount_amount, min_spend)")
      .eq("code", String(code).trim().toUpperCase())
      .maybeSingle();
    if (fetchErr || !redemption) return NextResponse.json({ error: "INVALID_CODE", message: "No reward found with that code" }, { status: 404 });

    if (redemption.status === "redeemed") {
      return NextResponse.json({ error: "ALREADY_REDEEMED", message: "This code has already been used" }, { status: 400 });
    }
    if (redemption.status === "cancelled") {
      return NextResponse.json({ error: "CANCELLED", message: "This code was cancelled" }, { status: 400 });
    }
    if (redemption.status === "expired" || new Date(redemption.expires_at) < new Date()) {
      if (redemption.status !== "expired") await supabase.from("loyalty_redemptions").update({ status: "expired" }).eq("id", redemption.id);
      return NextResponse.json({ error: "REWARD_EXPIRED", message: "This code has expired" }, { status: 400 });
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, status, subtotal, total")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status === "paid" || order.status === "cancelled") {
      return NextResponse.json({ error: "This order can no longer be changed" }, { status: 409 });
    }

    const reward = redemption.reward as { name: string; discount_amount: number | null; min_spend: number };
    if (reward.min_spend && Number(order.total) < Number(reward.min_spend)) {
      return NextResponse.json(
        { error: "MINIMUM_SPEND_NOT_MET", message: `This reward needs a spend of at least £${Number(reward.min_spend).toFixed(2)}` },
        { status: 400 }
      );
    }

    let updatedBill = null;
    if (reward.discount_amount != null && Number(reward.discount_amount) > 0) {
      await supabase
        .from("orders")
        .update({
          discount_type: "amount",
          discount_pct: null,
          discount: Number(reward.discount_amount),
          discount_reason: `Loyalty reward: ${reward.name}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);
      updatedBill = await recalcTotals(String(order_id));
    }

    const { error: updateErr } = await supabase
      .from("loyalty_redemptions")
      .update({
        status: "redeemed",
        redeemed_at: new Date().toISOString(),
        redeemed_by_staff_id: session.id,
        redeemed_order_id: order_id,
      })
      .eq("id", redemption.id);
    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, reward_name: reward.name, discount_applied: reward.discount_amount ?? 0, bill: updatedBill });
  } catch (error) {
    console.error("Redemption redeem error:", error);
    return NextResponse.json({ error: "Failed to redeem reward" }, { status: 500 });
  }
}
