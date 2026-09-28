import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getCustomerSessionFromRequest } from "@/lib/customer-auth";

// Everything the Loyalty tab needs in one call: current points, the active
// reward catalogue, this customer's active points voucher (if any), and their
// welcome voucher (from sign-up) if still unused — shown separately, since it
// isn't bought with points and doesn't count as "the" one active voucher. A
// voucher past its expires_at is lazily flipped to "expired" here rather than
// needing a cron, same pattern the redeem route already uses.
export async function GET(req: NextRequest) {
  const session = await getCustomerSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: customer } = await supabase.from("customers").select("loyalty_points").eq("id", session.id).maybeSingle();

  const { data: rewards } = await supabase
    .from("loyalty_rewards")
    .select("id, name, description, points_cost, discount_amount")
    .eq("active", 1)
    .eq("is_welcome_reward", false)
    .order("points_cost", { ascending: true });

  const { data: issued } = await supabase
    .from("loyalty_redemptions")
    .select("id, code, status, points_spent, issued_at, expires_at, valid_from, reward:loyalty_rewards(name, discount_amount, discount_pct, max_discount, order_types, is_welcome_reward)")
    .eq("customer_id", session.id)
    .eq("status", "issued")
    .order("issued_at", { ascending: false });

  const now = new Date();
  const expired = (issued ?? []).filter((r) => new Date(r.expires_at) < now);
  for (const r of expired) await supabase.from("loyalty_redemptions").update({ status: "expired" }).eq("id", r.id);
  const live = (issued ?? []).filter((r) => new Date(r.expires_at) >= now);
  const isWelcome = (r: (typeof live)[number]) => !!(r.reward as unknown as { is_welcome_reward?: boolean } | null)?.is_welcome_reward;

  return NextResponse.json({
    points: customer?.loyalty_points ?? 0,
    rewards: rewards || [],
    activeRedemption: live.find((r) => !isWelcome(r)) ?? null,
    welcomeVoucher: live.find(isWelcome) ?? null,
  });
}
