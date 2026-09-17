import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { issueRedemption } from "@/lib/loyalty";

// Daily job: award birthday points (if configured) and auto-issue any
// reward flagged is_birthday_reward, for every customer whose birthday is
// today — exactly once per customer per year, whichever runs it (cron here,
// or a manual re-trigger), same guard either way.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const todayMonth = now.getUTCMonth() + 1;
  const todayDay = now.getUTCDate();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, date_of_birth")
    .not("date_of_birth", "is", null);

  const birthdayCustomers = (customers || []).filter((c) => {
    const [, month, day] = (c.date_of_birth as string).split("-").map(Number);
    return month === todayMonth && day === todayDay;
  });

  if (birthdayCustomers.length === 0) return NextResponse.json({ processed: 0, results: [] });

  const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "loyalty_birthday_points").maybeSingle();
  const birthdayPoints = Number(setting?.value ?? 0);

  const { data: birthdayRewards } = await supabase.from("loyalty_rewards").select("id, name").eq("is_birthday_reward", true).eq("active", 1);

  const results: { customer_id: number; name: string; points_awarded: number; rewards_issued: string[]; skipped: boolean }[] = [];

  for (const c of birthdayCustomers) {
    // Already handled this year? Points and reward issuance are checked
    // together via the points row (reason=birthday_bonus) OR, when points
    // are disabled (0), via a redemption already issued this year for a
    // birthday-flagged reward — whichever signal applies.
    const { data: existingBonus } = await supabase
      .from("loyalty_transactions")
      .select("id")
      .eq("customer_id", c.id)
      .eq("reason", "birthday_bonus")
      .gte("created_at", yearStart)
      .limit(1);
    const { data: existingRedemption } = await supabase
      .from("loyalty_redemptions")
      .select("id")
      .eq("customer_id", c.id)
      .gte("issued_at", yearStart)
      .in("reward_id", (birthdayRewards || []).map((r) => r.id))
      .limit(1);
    if ((existingBonus && existingBonus.length > 0) || (existingRedemption && existingRedemption.length > 0)) {
      results.push({ customer_id: c.id, name: c.name, points_awarded: 0, rewards_issued: [], skipped: true });
      continue;
    }

    if (birthdayPoints > 0) {
      await supabase.from("loyalty_transactions").insert({
        customer_id: c.id,
        points_delta: birthdayPoints,
        reason: "birthday_bonus",
        reference_type: "birthday",
        reference_id: c.id,
      });
    }

    const issued: string[] = [];
    for (const reward of birthdayRewards || []) {
      const result = await issueRedemption(c.id, reward.id, null);
      if (result.ok) issued.push(result.redemption.code as string);
    }

    results.push({ customer_id: c.id, name: c.name, points_awarded: birthdayPoints, rewards_issued: issued, skipped: false });
  }

  return NextResponse.json({ processed: results.length, results });
}
