import supabase from "@/lib/supabase";
import { getActiveTiers, tierForSpend } from "@/lib/crm";

// Finds a customer by phone, or creates one. Used by public checkout/reservation
// and POS order creation so CRM data accumulates from flows that already exist,
// instead of requiring a separate "sign up" step.
export async function findOrCreateCustomerByPhone(phone: string, name: string, email?: string | null): Promise<number | null> {
  const cleanPhone = phone.trim();
  if (!cleanPhone) return null;

  const { data: existing } = await supabase.from("customers").select("id, email").eq("phone", cleanPhone).maybeSingle();
  if (existing) {
    // Backfill email if we now have one and didn't before — never overwrite an existing value.
    if (email && !existing.email) {
      await supabase.from("customers").update({ email }).eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ name: name.trim() || "Guest", phone: cleanPhone, email: email || null })
    .select("id")
    .single();
  if (error) {
    console.error("Customer auto-link error:", error);
    return null;
  }
  return created.id;
}

async function getSetting(key: string, fallback: number): Promise<number> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  const n = Number(data?.value ?? fallback);
  return isNaN(n) ? fallback : n;
}

// Points-per-£ rate is admin-configurable (app_settings), default 1 to match
// the previous hardcoded behaviour.
async function getPointsRate(): Promise<number> {
  const rate = await getSetting("loyalty_points_per_pound", 1);
  return rate <= 0 ? 1 : rate;
}

function expiryTimestamp(months: number): string | null {
  if (!months || months <= 0) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

// Base earn + tier-multiplier bonus, awarded once a payment fully settles an
// order. Tier is read from the customer's spend *before* this order, so a
// purchase that itself tips someone into a new tier earns at the old rate —
// the new tier only applies to the *next* purchase, matching the doc's
// worked example (bonus reflects the tier already held, not the one just
// reached). Recorded as two separate ledger lines (base, then bonus) rather
// than one blended total, so the ledger stays self-explanatory.
export async function awardPurchasePoints(customerId: number, orderTotal: number, orderId: number) {
  // Idempotency: never award twice for the same order, even if this were
  // ever called more than once (e.g. a retried request).
  const { data: existing } = await supabase
    .from("loyalty_transactions")
    .select("id")
    .eq("reference_type", "order")
    .eq("reference_id", orderId)
    .eq("reason", "earned_purchase")
    .limit(1);
  if (existing && existing.length > 0) return;

  const rate = await getPointsRate();
  const basePoints = Math.floor(orderTotal * rate);
  if (basePoints <= 0) return;

  const expiryMonths = await getSetting("loyalty_points_expiry_months", 12);
  const expiresAt = expiryTimestamp(expiryMonths);

  const { data: priorOrders } = await supabase
    .from("orders")
    .select("total")
    .eq("customer_id", customerId)
    .eq("status", "paid")
    .neq("id", orderId);
  const priorSpend = (priorOrders || []).reduce((s, o) => s + Number(o.total), 0);

  const tiers = await getActiveTiers();
  const tierBefore = tierForSpend(tiers, priorSpend);
  const multiplier = tierBefore?.points_multiplier ?? 1;
  const bonusPoints = multiplier > 1 ? Math.floor(basePoints * (multiplier - 1)) : 0;

  await supabase.from("loyalty_transactions").insert({
    customer_id: customerId,
    points_delta: basePoints,
    reason: "earned_purchase",
    reference_type: "order",
    reference_id: orderId,
    expires_at: expiresAt,
  });
  if (bonusPoints > 0) {
    await supabase.from("loyalty_transactions").insert({
      customer_id: customerId,
      points_delta: bonusPoints,
      reason: "tier_bonus",
      reference_type: "order",
      reference_id: orderId,
      expires_at: expiresAt,
    });
  }

  // Tier upgrade/downgrade check, now including this order's spend.
  const newSpend = priorSpend + orderTotal;
  const tierAfter = tierForSpend(tiers, newSpend);
  if (tierAfter && tierAfter.id !== tierBefore?.id) {
    await supabase.from("loyalty_tier_changes").insert({
      customer_id: customerId,
      from_tier_id: tierBefore?.id ?? null,
      to_tier_id: tierAfter.id,
      lifetime_spend_at_change: Math.round(newSpend * 100) / 100,
    });
  }

  await checkReferralCompletion(customerId, orderTotal);
}

// A referral is only rewarded once the referred customer completes a real
// qualifying purchase — not at registration (registration alone is too easy
// to abuse and doesn't prove the referral drove real business). Fires at
// most once per referred customer: guarded by customers.referral_completed_at.
async function checkReferralCompletion(customerId: number, orderTotal: number) {
  const { data: customer } = await supabase
    .from("customers")
    .select("id, referred_by_customer_id, referral_completed_at")
    .eq("id", customerId)
    .single();
  if (!customer?.referred_by_customer_id || customer.referral_completed_at) return;
  if (customer.referred_by_customer_id === customerId) return; // defensive: no self-referral

  const minSpend = await getSetting("loyalty_referral_min_spend", 20);
  if (orderTotal < minSpend) return;

  const refereePoints = await getSetting("loyalty_referral_referee_points", 500);
  const referrerPoints = await getSetting("loyalty_referral_referrer_points", 1000);

  // Mark completed first (guards against a second concurrent purchase racing
  // the same reward) — if either insert below fails, the referral simply
  // doesn't get rewarded rather than risking a double-award.
  const { error: markErr } = await supabase
    .from("customers")
    .update({ referral_completed_at: new Date().toISOString() })
    .eq("id", customerId)
    .is("referral_completed_at", null);
  if (markErr) return;

  await supabase.from("loyalty_transactions").insert([
    { customer_id: customerId, points_delta: refereePoints, reason: "referral_bonus", reference_type: "customer", reference_id: customer.referred_by_customer_id },
    { customer_id: customer.referred_by_customer_id, points_delta: referrerPoints, reason: "referral_bonus", reference_type: "customer", reference_id: customerId },
  ]);
}
