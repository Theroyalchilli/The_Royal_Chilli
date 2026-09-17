import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm } from "@/lib/permissions";
import { getActiveTiers, tierForSpend } from "@/lib/crm";
import { generateUniqueRedemptionCode } from "@/lib/loyalty";

// Issue a redemption: debit points now, hand the customer a code to bring
// back (same visit or a later one). Two steps — issue, then redeem at POS —
// rather than an instant apply, so there's a real audit trail of who issued
// it, whether it was ever used, and against which order.
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canViewCrm(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { customer_id, reward_id } = await req.json();
    if (!customer_id || !reward_id) {
      return NextResponse.json({ error: "customer_id and reward_id are required" }, { status: 400 });
    }

    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("id, loyalty_points")
      .eq("id", customer_id)
      .single();
    if (custErr || !customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const { data: reward, error: rewardErr } = await supabase
      .from("loyalty_rewards")
      .select("*")
      .eq("id", reward_id)
      .single();
    if (rewardErr || !reward) return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    if (!reward.active) return NextResponse.json({ error: "This reward is no longer available" }, { status: 400 });

    const todayStr = new Date().toISOString().slice(0, 10);
    if (reward.start_date && todayStr < reward.start_date) {
      return NextResponse.json({ error: "This reward isn't available yet" }, { status: 400 });
    }
    if (reward.end_date && todayStr > reward.end_date) {
      return NextResponse.json({ error: "This reward has ended" }, { status: 400 });
    }

    if (customer.loyalty_points < reward.points_cost) {
      return NextResponse.json(
        { error: `Not enough points — needs ${reward.points_cost}, has ${customer.loyalty_points}` },
        { status: 400 }
      );
    }

    if (reward.eligible_tier_id) {
      const { data: paidOrders } = await supabase.from("orders").select("total").eq("customer_id", customer_id).eq("status", "paid");
      const lifetimeSpend = (paidOrders || []).reduce((s, o) => s + Number(o.total), 0);
      const tiers = await getActiveTiers();
      const customerTier = tierForSpend(tiers, lifetimeSpend);
      const requiredTier = tiers.find((t) => t.id === reward.eligible_tier_id);
      const customerRank = tiers.findIndex((t) => t.id === customerTier?.id);
      const requiredRank = tiers.findIndex((t) => t.id === requiredTier?.id);
      if (requiredTier && customerRank < requiredRank) {
        return NextResponse.json({ error: `This reward requires ${requiredTier.name} tier or above` }, { status: 400 });
      }
    }

    if (reward.per_customer_limit != null) {
      const { count } = await supabase
        .from("loyalty_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customer_id)
        .eq("reward_id", reward_id)
        .in("status", ["issued", "redeemed"]);
      if ((count ?? 0) >= reward.per_customer_limit) {
        return NextResponse.json({ error: "This customer has already used this reward the maximum number of times" }, { status: 400 });
      }
    }

    const code = await generateUniqueRedemptionCode();
    const expiresAt = new Date(Date.now() + Number(reward.valid_days || 7) * 24 * 60 * 60 * 1000);

    const { data: redemption, error: redemptionErr } = await supabase
      .from("loyalty_redemptions")
      .insert({
        code,
        customer_id,
        reward_id,
        points_spent: reward.points_cost,
        status: "issued",
        issued_by_staff_id: session.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();
    if (redemptionErr) throw redemptionErr;

    const { error: ledgerErr } = await supabase.from("loyalty_transactions").insert({
      customer_id,
      points_delta: -reward.points_cost,
      reason: "redeemed_reward",
      reference_type: "redemption",
      reference_id: redemption.id,
      staff_id: session.id,
    });
    if (ledgerErr) {
      // Compensate — don't leave an issued redemption whose points were never debited.
      await supabase.from("loyalty_redemptions").delete().eq("id", redemption.id);
      throw ledgerErr;
    }

    return NextResponse.json({ success: true, redemption: { ...redemption, reward_name: reward.name } }, { status: 201 });
  } catch (error) {
    console.error("Redemption issue error:", error);
    return NextResponse.json({ error: "Failed to issue redemption" }, { status: 500 });
  }
}
