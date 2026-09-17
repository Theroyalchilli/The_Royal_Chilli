import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageCrm } from "@/lib/permissions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !canManageCrm(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const fields = [
      "name", "description", "points_cost", "discount_amount", "min_spend",
      "eligible_tier_id", "valid_days", "per_customer_limit", "start_date", "end_date", "active", "is_birthday_reward",
    ];
    const updates: Record<string, unknown> = {};
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f] === "" ? null : body[f];
    }
    if (updates.active !== undefined) updates.active = updates.active ? 1 : 0;

    const { data, error } = await supabase.from("loyalty_rewards").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, reward: data });
  } catch (error) {
    console.error("Reward update error:", error);
    return NextResponse.json({ error: "Failed to update reward" }, { status: 500 });
  }
}
