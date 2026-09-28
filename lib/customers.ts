import bcrypt from "bcryptjs";
import supabase from "@/lib/supabase";
import { getActiveTiers, tierForSpend } from "@/lib/crm";
import {
  doublePointsDay,
  findReferrer,
  generateReferralCode,
  getPointsExpiryTimestamp,
  issueReferralVoucher,
  issueSignupPoints,
  issueWelcomeVoucher,
  unlockReferralVoucher,
} from "@/lib/loyalty";
import type { Customer } from "@/lib/types";

// Every column except password_hash — use this instead of select("*") on
// customers anywhere the result reaches an HTTP response, staff or public.
// (Mirrors app/api/employees/route.ts's PROFILE_FIELDS for the same reason.)
export const CUSTOMER_SAFE_FIELDS =
  "id, name, phone, email, date_of_birth, address, notes, loyalty_points, referral_code, referred_by_customer_id, referral_completed_at, marketing_consent, created_at";

// Self-service signup: name + email + password only (no phone yet — that's
// added later from the profile). If an existing guest row already has this
// email (from a past phone-based checkout that also gave an email), this
// *claims* that row instead of creating a duplicate — the customer keeps
// their real order/loyalty history rather than starting over at zero.
export async function signupCustomer(
  name: string,
  email: string,
  password: string,
  marketingConsent = false,
  referralCode?: string | null,
): Promise<{ ok: true; customer: Customer } | { ok: false; error: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const { data: existing } = await supabase
    .from("customers")
    .select("id, name, password_hash, referral_code")
    .ilike("email", cleanEmail)
    .maybeSingle();

  if (existing?.password_hash) {
    return { ok: false, error: "An account with this email already exists — try logging in instead." };
  }

  const password_hash = await bcrypt.hash(password, 10);

  if (existing) {
    // Claim the existing guest row — keep its name if it already had a real
    // one (not the "Guest" placeholder findOrCreateCustomerByPhone uses).
    const { data, error } = await supabase
      .from("customers")
      .update({
        password_hash,
        name: existing.name && existing.name !== "Guest" ? existing.name : name.trim(),
        marketing_consent: marketingConsent,
        ...(existing.referral_code ? {} : { referral_code: await generateReferralCode() }),
      })
      .eq("id", existing.id)
      .select(CUSTOMER_SAFE_FIELDS)
      .single();
    if (error) return { ok: false, error: "Failed to create account" };
    // Rewards Club welcome: sign-up points + the 20% dine-in voucher (next
    // visit). Not a *new* customer, so no Bring a Friend reward for anyone.
    await issueSignupPoints(existing.id);
    await issueWelcomeVoucher(existing.id);
    return { ok: true, customer: data as Customer };
  }

  const referrerId = await findReferrer(referralCode);
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: name.trim(),
      email: cleanEmail,
      password_hash,
      marketing_consent: marketingConsent,
      referral_code: await generateReferralCode(),
      referred_by_customer_id: referrerId,
    })
    .select(CUSTOMER_SAFE_FIELDS)
    .single();
  if (error) return { ok: false, error: "Failed to create account" };
  await issueSignupPoints(data.id);
  await issueWelcomeVoucher(data.id);
  if (referrerId) await issueReferralVoucher(referrerId, data.id);
  return { ok: true, customer: data as Customer };
}

export async function verifyCustomerLogin(
  email: string,
  password: string
): Promise<{ ok: true; customer: Customer } | { ok: false; error: string }> {
  const { data } = await supabase
    .from("customers")
    .select(`${CUSTOMER_SAFE_FIELDS}, password_hash`)
    .ilike("email", email.trim().toLowerCase())
    .maybeSingle();

  // Same generic error whether the email doesn't exist or the password is
  // wrong — never reveal which one it was.
  if (!data || !data.password_hash) {
    return { ok: false, error: "Invalid email or password" };
  }
  const valid = await bcrypt.compare(password, data.password_hash as string);
  if (!valid) {
    return { ok: false, error: "Invalid email or password" };
  }
  const { password_hash: _omit, ...customer } = data as Customer & { password_hash: string };
  return { ok: true, customer: customer as Customer };
}

// Finds a customer by phone, or creates one. Used by public checkout/reservation
// and POS order creation so CRM data accumulates from flows that already exist,
// instead of requiring a separate "sign up" step.
//
// marketingConsent is one-directional here: a `true` (the customer just
// ticked "email me offers") turns consent on; anything else leaves whatever
// is already stored untouched — an order where the box wasn't ticked must
// never silently revoke consent given on an earlier order.
export async function findOrCreateCustomerByPhone(
  phone: string,
  name: string,
  email?: string | null,
  marketingConsent?: boolean
): Promise<number | null> {
  const cleanPhone = phone.trim();
  if (!cleanPhone) return null;

  const { data: existing } = await supabase.from("customers").select("id, email").eq("phone", cleanPhone).maybeSingle();
  if (existing) {
    const updates: Record<string, unknown> = {};
    // Backfill email if we now have one and didn't before — never overwrite an existing value.
    if (email && !existing.email) updates.email = email;
    if (marketingConsent === true) updates.marketing_consent = true;
    if (Object.keys(updates).length > 0) {
      await supabase.from("customers").update(updates).eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ name: name.trim() || "Guest", phone: cleanPhone, email: email || null, marketing_consent: marketingConsent === true })
    .select("id")
    .single();
  if (error) {
    console.error("Customer auto-link error:", error);
    return null;
  }
  return created.id;
}

/**
 * Joining the Rewards Club at the till: find the customer by phone (or make
 * them), and give the full welcome — sign-up points + the 20% voucher for
 * their next visit — if they haven't had it yet. (A guest row made silently
 * from an earlier order hasn't: joining is what earns it.)
 */
export async function joinMemberAtTill(input: {
  name: string;
  phone: string;
  email?: string | null;
  marketingConsent?: boolean;
}): Promise<{ ok: true; customerId: number; alreadyMember: boolean } | { ok: false; error: string }> {
  const phone = input.phone.trim();
  const email = input.email?.trim().toLowerCase() || null;
  if (!phone) return { ok: false, error: "Phone number is required" };

  if (email) {
    const { data: byEmail } = await supabase.from("customers").select("id, phone").ilike("email", email).maybeSingle();
    if (byEmail && byEmail.phone && byEmail.phone !== phone) {
      return { ok: false, error: "That email already belongs to another member — search for them instead" };
    }
  }

  const customerId = await findOrCreateCustomerByPhone(phone, input.name || "Guest", email, input.marketingConsent === true);
  if (!customerId) return { ok: false, error: "Couldn't create the member" };

  const { data: c } = await supabase.from("customers").select("name, referral_code").eq("id", customerId).single();
  const updates: Record<string, unknown> = {};
  if (!c?.referral_code) updates.referral_code = await generateReferralCode();
  if (input.name.trim() && (!c?.name || c.name === "Guest")) updates.name = input.name.trim();
  if (Object.keys(updates).length) await supabase.from("customers").update(updates).eq("id", customerId);

  const { data: had } = await supabase
    .from("loyalty_transactions")
    .select("id")
    .eq("customer_id", customerId)
    .eq("reason", "welcome_bonus")
    .limit(1);
  const alreadyMember = !!(had && had.length);
  await issueSignupPoints(customerId);
  await issueWelcomeVoucher(customerId);
  return { ok: true, customerId, alreadyMember };
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

// Read-only preview of what awardPurchasePoints would actually award for
// this order right now — same rate/tier logic, just never writes anything.
// Used to show staff a live "+N points" figure during payment, so it can
// never disagree with what actually posts once the payment completes.
export async function estimatePurchasePoints(
  customerId: number,
  orderTotal: number,
): Promise<{ base: number; bonus: number; midweek: number; doubleDay: string | null; total: number; tierName: string | null; multiplier: number }> {
  const rate = await getPointsRate();
  const base = Math.floor(orderTotal * rate);

  const { data: paidOrders } = await supabase
    .from("orders")
    .select("total")
    .eq("customer_id", customerId)
    .eq("is_paid", true);
  const lifetimeSpend = (paidOrders || []).reduce((s, o) => s + Number(o.total), 0);

  const tiers = await getActiveTiers();
  const tier = tierForSpend(tiers, lifetimeSpend);
  const multiplier = tier?.points_multiplier ?? 1;
  const bonus = multiplier > 1 ? Math.floor(base * (multiplier - 1)) : 0;
  const doubleDay = await doublePointsDay();
  const midweek = doubleDay ? base : 0;

  return {
    base,
    bonus,
    midweek,
    doubleDay,
    total: base + bonus + midweek,
    // tiers only matter while they multiply anything (Rewards Club: they don't)
    tierName: multiplier > 1 ? (tier?.name ?? null) : null,
    multiplier,
  };
}

// Base earn + tier-multiplier bonus, awarded once a payment fully settles an
// order. Tier is read from the customer's spend *before* this order, so a
// purchase that itself tips someone into a new tier earns at the old rate —
// the new tier only applies to the *next* purchase, matching the doc's
// worked example (bonus reflects the tier already held, not the one just
// reached). Recorded as two separate ledger lines (base, then bonus) rather
// than one blended total, so the ledger stays self-explanatory.
// `paidAt` is when the bill was paid — decides Tue–Thu doubling (defaults to
// now; a receipt claimed days later passes the original payment time).
export async function awardPurchasePoints(customerId: number, orderTotal: number, orderId: number, paidAt: Date = new Date()) {
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

  const expiresAt = await getPointsExpiryTimestamp();

  const { data: priorOrders } = await supabase
    .from("orders")
    .select("total")
    .eq("customer_id", customerId)
    .eq("is_paid", true)
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
  // Quiet-day doubling (Tue–Thu): the base earn again, as its own ledger line
  // so the customer's history reads "Midweek 2×".
  if (await doublePointsDay(paidAt)) {
    await supabase.from("loyalty_transactions").insert({
      customer_id: customerId,
      points_delta: basePoints,
      reason: "midweek_bonus",
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

// Bring a Friend: the referrer's £5 voucher unlocks once the referred
// customer completes a real qualifying purchase (min spend setting, £20) —
// not at registration, which is too easy to abuse. Fires at most once per
// referred customer: guarded by customers.referral_completed_at.
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

  // Mark completed first so a second concurrent purchase can't race it.
  const { data: marked } = await supabase
    .from("customers")
    .update({ referral_completed_at: new Date().toISOString() })
    .eq("id", customerId)
    .is("referral_completed_at", null)
    .select("id");
  if (!marked || marked.length === 0) return;

  await unlockReferralVoucher(customerId);
}
