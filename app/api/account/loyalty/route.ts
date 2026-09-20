import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getCustomerSessionFromRequest } from "@/lib/customer-auth";

// Everything the Loyalty tab needs in one call: current points, the active
// reward catalogue, and this customer's active voucher (if any) — a voucher
// past its expires_at is lazily flipped to "expired" here rather than
// needing a cron, same pattern the redeem route already uses.
export async function GET(req: NextRequest) {
  const session = await getCustomerSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: customer } = await supabase.from("customers").select("loyalty_points").eq("id", session.id).maybeSingle();

  const { data: rewards } = await supabase
    .from("loyalty_rewards")
    .select("id, name, description, points_cost, discount_amount")
    .eq("active", 1)
    .order("points_cost", { ascending: true });

  const { data: redemption } = await supabase
    .from("loyalty_redemptions")
    .select("id, code, status, points_spent, issued_at, expires_at, reward:loyalty_rewards(name, discount_amount)")
    .eq("customer_id", session.id)
    .eq("status", "issued")
    .order("issued_at", { ascending: false })
    .maybeSingle();

  let activeRedemption = redemption;
  if (redemption && new Date(redemption.expires_at) < new Date()) {
    await supabase.from("loyalty_redemptions").update({ status: "expired" }).eq("id", redemption.id);
    activeRedemption = null;
  }

  return NextResponse.json({
    points: customer?.loyalty_points ?? 0,
    rewards: rewards || [],
    activeRedemption: activeRedemption || null,
  });
}
