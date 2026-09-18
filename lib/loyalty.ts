import { randomBytes } from "crypto";
import supabase from "@/lib/supabase";
import { getActiveTiers, tierForSpend } from "@/lib/crm";

export async function getLoyaltySetting(key: string, fallback: number): Promise<number> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  const n = Number(data?.value ?? fallback);
  return isNaN(n) ? fallback : n;
}

// Shared by every code path that awards earning-type points (purchase,
// tier bonus, referral, birthday) so they're all swept by the same expiry
// cron consistently — a reason listed in EXPIRABLE_REASONS but never given
// an expires_at here would simply never expire, silently.
export async function getPointsExpiryTimestamp(): Promise<string | null> {
  const months = await getLoyaltySetting("loyalty_points_expiry_months", 12);
  if (!months || months <= 0) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

// Direct points-to-money redemption — the everyday "use my points" button
// on the payment screen, separate from the reward catalogue. Only ever
// offered in fixed £-cap chunks: a balance worth less than the cap earns
// no partial credit (keeps accumulating toward the next full chunk), and a
// balance worth more than the cap still only redeems one chunk per
// transaction (the rest stays banked for next time).
export type CashCreditInfo = { rate: number; cap: number; convertedValue: number; eligible: boolean; redeemAmount: number; redeemPoints: number };

export async function getCashCreditInfo(loyaltyPoints: number): Promise<CashCreditInfo> {
  const rate = await getLoyaltySetting("loyalty_conversion_points_per_pound", 100);
  const cap = await getLoyaltySetting("loyalty_max_redeem_per_visit", 5);
  const convertedValue = Math.floor((loyaltyPoints / rate) * 100) / 100;
  const eligible = convertedValue >= cap;
  return {
    rate,
    cap,
    convertedValue,
    eligible,
    redeemAmount: eligible ? cap : 0,
    redeemPoints: eligible ? Math.round(cap * rate) : 0,
  };
}

// Unambiguous alphabet — no 0/O, 1/I/L — so a code read aloud or handwritten
// isn't misheard/miscopied. Not sequential/guessable (doc §23): drawn from
// crypto.randomBytes, not Math.random().
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateRedemptionCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

export async function generateUniqueRedemptionCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRedemptionCode();
    const { data } = await supabase.from("loyalty_redemptions").select("id").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not generate a unique redemption code");
}

export type IssueRedemptionResult =
  | { ok: true; redemption: Record<string, unknown> & { id: number; code: string }; rewardName: string }
  | { ok: false; error: string };

// Shared by the staff-facing "issue a reward" endpoint and the birthday
// cron — same validation, same code/expiry generation, same audit trail,
// whichever triggers it. `staffId` is null for an automatic (cron) issue.
export async function issueRedemption(customerId: number, rewardId: number, staffId: number | null): Promise<IssueRedemptionResult> {
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("id, loyalty_points")
    .eq("id", customerId)
    .single();
  if (custErr || !customer) return { ok: false, error: "Customer not found" };

  const { data: reward, error: rewardErr } = await supabase
    .from("loyalty_rewards")
    .select("*")
    .eq("id", rewardId)
    .single();
  if (rewardErr || !reward) return { ok: false, error: "Reward not found" };
  if (!reward.active) return { ok: false, error: "This reward is no longer available" };

  const todayStr = new Date().toISOString().slice(0, 10);
  if (reward.start_date && todayStr < reward.start_date) return { ok: false, error: "This reward isn't available yet" };
  if (reward.end_date && todayStr > reward.end_date) return { ok: false, error: "This reward has ended" };

  if (customer.loyalty_points < reward.points_cost) {
    return { ok: false, error: `Not enough points — needs ${reward.points_cost}, has ${customer.loyalty_points}` };
  }

  if (reward.eligible_tier_id) {
    const { data: paidOrders } = await supabase.from("orders").select("total").eq("customer_id", customerId).eq("status", "paid");
    const lifetimeSpend = (paidOrders || []).reduce((s, o) => s + Number(o.total), 0);
    const tiers = await getActiveTiers();
    const customerTier = tierForSpend(tiers, lifetimeSpend);
    const requiredTier = tiers.find((t) => t.id === reward.eligible_tier_id);
    const customerRank = tiers.findIndex((t) => t.id === customerTier?.id);
    const requiredRank = tiers.findIndex((t) => t.id === requiredTier?.id);
    if (requiredTier && customerRank < requiredRank) {
      return { ok: false, error: `This reward requires ${requiredTier.name} tier or above` };
    }
  }

  if (reward.per_customer_limit != null) {
    const { count } = await supabase
      .from("loyalty_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .eq("reward_id", rewardId)
      .in("status", ["issued", "redeemed"]);
    if ((count ?? 0) >= reward.per_customer_limit) {
      return { ok: false, error: "This customer has already used this reward the maximum number of times" };
    }
  }

  const code = await generateUniqueRedemptionCode();
  const expiresAt = new Date(Date.now() + Number(reward.valid_days || 7) * 24 * 60 * 60 * 1000);

  const { data: redemption, error: redemptionErr } = await supabase
    .from("loyalty_redemptions")
    .insert({
      code,
      customer_id: customerId,
      reward_id: rewardId,
      points_spent: reward.points_cost,
      status: "issued",
      issued_by_staff_id: staffId,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();
  if (redemptionErr) return { ok: false, error: "Failed to issue redemption" };

  if (reward.points_cost > 0) {
    const { error: ledgerErr } = await supabase.from("loyalty_transactions").insert({
      customer_id: customerId,
      points_delta: -reward.points_cost,
      reason: "redeemed_reward",
      reference_type: "redemption",
      reference_id: redemption.id,
      staff_id: staffId,
    });
    if (ledgerErr) {
      // Compensate — don't leave an issued redemption whose points were never debited.
      await supabase.from("loyalty_redemptions").delete().eq("id", redemption.id);
      return { ok: false, error: "Failed to issue redemption" };
    }
  }

  return { ok: true, redemption, rewardName: reward.name };
}
