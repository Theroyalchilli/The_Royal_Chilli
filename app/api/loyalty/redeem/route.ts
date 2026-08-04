import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canViewCrm(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { customer_id, reward_id } = await req.json();
    if (!customer_id || !reward_id) return NextResponse.json({ error: "customer_id and reward_id are required" }, { status: 400 });

    const { data: customer, error: custErr } = await supabase.from("customers").select("id, loyalty_points").eq("id", customer_id).single();
    if (custErr || !customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const { data: reward, error: rewardErr } = await supabase.from("loyalty_rewards").select("*").eq("id", reward_id).single();
    if (rewardErr || !reward) return NextResponse.json({ error: "Reward not found" }, { status: 404 });

    if (customer.loyalty_points < reward.points_cost) {
      return NextResponse.json({ error: `Not enough points — needs ${reward.points_cost}, has ${customer.loyalty_points}` }, { status: 400 });
    }

    const { error } = await supabase.from("loyalty_transactions").insert({
      customer_id, points_delta: -reward.points_cost, reason: "redeemed_reward",
      reference_type: "reward", reference_id: reward_id, staff_id: session.id,
    });
    if (error) throw error;

    return NextResponse.json({ success: true, points_spent: reward.points_cost });
  } catch (error) {
    console.error("Redeem error:", error);
    return NextResponse.json({ error: "Failed to redeem reward" }, { status: 500 });
  }
}
