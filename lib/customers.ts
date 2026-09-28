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
import { awardVisitBonus } from "@/lib/visits";
import { findByPhone, findMember, type MemberSummary } from "@/lib/customer-match";
import { mergeCustomers } from "@/lib/customer-merge";
import { normalizeUkMobile, phoneKey } from "@/lib/phone";

const RESTAURANT_PHONE = "020 8797 3044";
import { sendReferralUnlockedFor, sendWelcomeFor } from "@/lib/rewards-emails";

// Every column except password_hash — use this instead of select("*") on
// customers anywhere the result reaches an HTTP response, staff or public.
// (Mirrors app/api/employees/route.ts's PROFILE_FIELDS for the same reason.)
export const CUSTOMER_SAFE_FIELDS =
  "id, name, phone, email, date_of_birth, address, notes, loyalty_points, referral_code, referred_by_customer_id, referral_completed_at, marketing_consent, created_at";

// Self-service signup: name + mobile + email + password. One customer, one
// record (lib/customer-match.ts): if the mobile or email already belongs to a
// guest record (from till or online orders), the account *claims* it — their
// orders and points come with them instead of starting a duplicate at zero.
export type SignupResult = { ok: true; customer: Customer } | { ok: false; error: string };

export async function signupCustomer(
  name: string,
  email: string,
  password: string,
  marketingConsent = false,
  referralCode?: string | null,
  phone?: string | null,
): Promise<SignupResult> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = normalizeUkMobile(phone);
  if (!cleanPhone) return { ok: false, error: "Please enter a UK mobile number (starts with 07)." };

  const match = await findMember(cleanPhone, cleanEmail);
  let claimId: number | null = null;
  if (match.kind === "conflict") {
    if (!match.mergeable || match.emailMember.has_account) {
      return {
        ok: false,
        error: match.emailMember.has_account
          ? "An account with this email already exists — try logging in instead."
          : `That mobile number is already registered to another account. Log in, or call us on ${RESTAURANT_PHONE}.`,
      };
    }
    // the mobile's guest record and the email's record are the same person
    const merged = await mergeCustomers(match.emailMember.id, match.phoneMember.id, { reason: "website sign-up" });
    if (!merged.ok) return { ok: false, error: "Failed to create account" };
    claimId = match.emailMember.id;
  } else if (match.kind === "match") {
    if (match.member.has_account) {
      return { ok: false, error: "An account with this email or mobile already exists — try logging in instead." };
    }
    claimId = match.member.id;
  }

  const password_hash = await bcrypt.hash(password, 10);

  if (claimId) {
    const { data: existing } = await supabase.from("customers").select("name, referral_code").eq("id", claimId).single();
    // Keep its name if it already had a real one (not the "Guest" placeholder).
    const { data, error } = await supabase
      .from("customers")
      .update({
        password_hash,
        email: cleanEmail,
        phone: cleanPhone,
        name: existing?.name && existing.name !== "Guest" ? existing.name : name.trim(),
        marketing_consent: marketingConsent,
        ...(existing?.referral_code ? {} : { referral_code: await generateReferralCode() }),
      })
      .eq("id", claimId)
      .select(CUSTOMER_SAFE_FIELDS)
      .single();
    if (error) return { ok: false, error: "Failed to create account" };
    // Rewards Club welcome: sign-up points + the 20% dine-in voucher (next
    // visit). Not a *new* customer, so no Bring a Friend reward for anyone.
    const isNew = await issueSignupPoints(claimId);
    await issueWelcomeVoucher(claimId);
    if (isNew) await sendWelcomeFor(claimId);
    return { ok: true, customer: data as Customer };
  }

  const referrerId = await findReferrer(referralCode);
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
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
  await sendWelcomeFor(data.id);
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
    // guest rows can share an email; only one *account* per email (unique index)
    .not("password_hash", "is", null)
    .is("merged_into", null)
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
  const cleanPhone = phoneKey(phone);
  if (!cleanPhone) return null;
  const cleanEmail = email?.trim().toLowerCase() || null;

  // Match on mobile OR email (lib/customer-match.ts). A quick order that hits
  // two different records goes by the mobile — the email is left alone.
  const match = await findMember(cleanPhone, cleanEmail);
  const existing = match.kind === "match" ? match.member : match.kind === "conflict" ? match.phoneMember : null;
  if (existing) {
    const updates: Record<string, unknown> = {};
    // Backfill what's missing — never overwrite an existing value.
    if (cleanEmail && !existing.email && match.kind === "match") updates.email = cleanEmail;
    if (!existing.phone && match.kind === "match") updates.phone = cleanPhone;
    if (marketingConsent === true) updates.marketing_consent = true;
    if (Object.keys(updates).length > 0) {
      await supabase.from("customers").update(updates).eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ name: name.trim() || "Guest", phone: cleanPhone, email: cleanEmail, marketing_consent: marketingConsent === true })
    .select("id")
    .single();
  if (error) {
    console.error("Customer auto-link error:", error);
    return null;
  }
  return created.id;
}

/**
 * Which customer a website / QR order or booking belongs to. Logged in → always
 * their own account, whatever number they typed (it might be a partner's);
 * their mobile is added to the account if it has none and nobody else has it.
 * Not logged in → matched on mobile OR email as usual.
 */
export async function customerForOrder(
  accountId: number | null | undefined,
  phone: string | null | undefined,
  name: string,
  email?: string | null,
  marketingConsent?: boolean,
): Promise<number | null> {
  if (accountId) {
    const { data: me } = await supabase.from("customers").select("id, phone, merged_into").eq("id", accountId).maybeSingle();
    if (me && !me.merged_into) {
      const updates: Record<string, unknown> = {};
      const mobile = normalizeUkMobile(phone);
      if (!me.phone && mobile && !(await findByPhone(mobile))) updates.phone = mobile;
      if (marketingConsent === true) updates.marketing_consent = true;
      if (Object.keys(updates).length) await supabase.from("customers").update(updates).eq("id", me.id);
      return me.id;
    }
  }
  if (!phone || !String(phone).trim()) return null;
  return findOrCreateCustomerByPhone(String(phone), name, email, marketingConsent);
}

/**
 * Joining the Rewards Club at the till (mobile + email required). Matches on
 * mobile OR email; if they point at two different people, returns the two so
 * staff can pick (`useCustomerId` on the retry). Gives the full welcome —
 * sign-up points + the 20% voucher for their next visit — if they haven't
 * had it (a guest row made from an earlier order hasn't: joining earns it).
 */
export type JoinResult =
  | { ok: true; customerId: number; alreadyMember: boolean }
  | { ok: false; error: string; conflict?: { phoneMember: MemberSummary; emailMember: MemberSummary } };

export async function joinMemberAtTill(input: {
  name: string;
  phone: string;
  email: string;
  marketingConsent?: boolean;
  useCustomerId?: number | null;
}): Promise<JoinResult> {
  const phone = normalizeUkMobile(input.phone);
  const email = input.email.trim().toLowerCase();
  if (!phone) return { ok: false, error: "Enter a UK mobile number (starts with 07)" };
  if (!email) return { ok: false, error: "Email is required to join" };

  let customerId: number;
  if (input.useCustomerId) {
    customerId = input.useCustomerId; // staff chose which record after a conflict
  } else {
    const match = await findMember(phone, email);
    if (match.kind === "conflict") {
      if (!match.mergeable) return { ok: false, error: "These belong to two different people", conflict: match };
      const merged = await mergeCustomers(match.emailMember.id, match.phoneMember.id, { reason: "joined at the till" });
      if (!merged.ok) return { ok: false, error: merged.error };
      customerId = match.emailMember.id;
    } else if (match.kind === "match") {
      customerId = match.member.id;
    } else {
      const { data: created, error } = await supabase
        .from("customers")
        .insert({ name: input.name.trim() || "Guest", phone, email, marketing_consent: input.marketingConsent === true })
        .select("id")
        .single();
      if (error || !created) return { ok: false, error: "Couldn't create the member" };
      customerId = created.id;
    }
  }

  // Fill in what the record is missing (never overwrite, never take a number
  // or email that's on someone else's record).
  const { data: c } = await supabase.from("customers").select("name, phone, email, referral_code").eq("id", customerId).single();
  const updates: Record<string, unknown> = {};
  if (!c?.referral_code) updates.referral_code = await generateReferralCode();
  if (input.name.trim() && (!c?.name || c.name === "Guest")) updates.name = input.name.trim();
  if (!c?.phone && !(await findByPhone(phone))) updates.phone = phone;
  if (!c?.email) updates.email = email;
  if (input.marketingConsent === true) updates.marketing_consent = true;
  if (Object.keys(updates).length) await supabase.from("customers").update(updates).eq("id", customerId);

  const { data: had } = await supabase
    .from("loyalty_transactions")
    .select("id")
    .eq("customer_id", customerId)
    .eq("reason", "welcome_bonus")
    .limit(1);
  const alreadyMember = !!(had && had.length);
  const isNew = await issueSignupPoints(customerId);
  await issueWelcomeVoucher(customerId);
  if (isNew) await sendWelcomeFor(customerId);
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

  // 2nd / 3rd / every-5th visit bonus (lib/visits.ts)
  await awardVisitBonus(customerId, orderId);

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

  const referrerId = await unlockReferralVoucher(customerId);
  if (referrerId) await sendReferralUnlockedFor(referrerId, customerId);
}
