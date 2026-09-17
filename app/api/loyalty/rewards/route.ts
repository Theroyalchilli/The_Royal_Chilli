import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm, canManageCrm } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canViewCrm(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("loyalty_rewards")
    .select("*, eligible_tier:loyalty_tiers(name)")
    .eq("active", 1)
    .order("points_cost");
  if (error) return NextResponse.json({ error: "Failed to fetch rewards" }, { status: 500 });
  const flat = (data || []).map((r) => {
    const { eligible_tier: t, ...rest } = r as typeof r & { eligible_tier: { name: string } | null };
    return { ...rest, eligible_tier_name: t?.name ?? null };
  });
  return NextResponse.json({ rewards: flat });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageCrm(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const {
      name, description, points_cost, discount_amount, min_spend,
      eligible_tier_id, valid_days, per_customer_limit, start_date, end_date,
    } = await req.json();
    if (!name || !points_cost) return NextResponse.json({ error: "Name and points_cost are required" }, { status: 400 });

    const { data, error } = await supabase
      .from("loyalty_rewards")
      .insert({
        name,
        description: description || null,
        points_cost,
        discount_amount: discount_amount != null && discount_amount !== "" ? Number(discount_amount) : null,
        min_spend: min_spend != null && min_spend !== "" ? Number(min_spend) : 0,
        eligible_tier_id: eligible_tier_id || null,
        valid_days: valid_days != null && valid_days !== "" ? Number(valid_days) : 7,
        per_customer_limit: per_customer_limit != null && per_customer_limit !== "" ? Number(per_customer_limit) : null,
        start_date: start_date || null,
        end_date: end_date || null,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, reward: data }, { status: 201 });
  } catch (error) {
    console.error("Reward create error:", error);
    return NextResponse.json({ error: "Failed to create reward" }, { status: 500 });
  }
}
