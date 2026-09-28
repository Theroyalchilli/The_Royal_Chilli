import supabase from "@/lib/supabase";
import {
  sendNudgeEmail,
  sendReferralUnlockedEmail,
  sendReviewRequestEmail,
  sendThankYouEmail,
  sendWelcomeEmail,
} from "@/lib/email";
import { tradingDayStr, tradingRangeUtc } from "@/lib/london-date";
import { getLoyaltySetting, ORDER_EARN_REASONS } from "@/lib/loyalty";
import { unsubscribeUrl } from "@/lib/unsubscribe";
import { getVisitBonusRules, visitBonusFor } from "@/lib/visits";

// Rewards Club emails (phase 4). Welcome and "your £5 is unlocked" are about
// the customer's own account, so they go to everyone with an email. The
// thank-you and the 10-day nudge are marketing: only customers who ticked
// "email me offers" (customers.marketing_consent), each with an unsubscribe
// link. Every send is best-effort — it never fails whatever triggered it.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://royal-chilli-pos.vercel.app";
const ACCOUNT_URL = `${SITE_URL}/account/loyalty`;
export const NUDGE_AFTER_DAYS = 10;

type Voucher = { code: string; valid_from: string | null; expires_at: string };

async function unusedWelcomeVoucher(customerId: number): Promise<Voucher | null> {
  const { data } = await supabase
    .from("loyalty_redemptions")
    .select("code, valid_from, expires_at, reward:loyalty_rewards!inner(is_welcome_reward)")
    .eq("customer_id", customerId)
    .eq("status", "issued")
    .eq("reward.is_welcome_reward", true)
    .gt("expires_at", new Date().toISOString())
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { code: data.code, valid_from: data.valid_from, expires_at: data.expires_at } : null;
}

/** Just joined (website or till): welcome email with their voucher and friend link. */
export async function sendWelcomeFor(customerId: number): Promise<void> {
  try {
    const { data: c } = await supabase.from("customers").select("name, email, referral_code").eq("id", customerId).single();
    if (!c?.email) return;
    const voucher = await unusedWelcomeVoucher(customerId);
    await sendWelcomeEmail(c.email, {
      customerName: c.name,
      signupPoints: await getLoyaltySetting("loyalty_signup_points", 0),
      voucherCode: voucher?.code ?? null,
      voucherValidFrom: voucher?.valid_from ?? null,
      voucherExpiresAt: voucher?.expires_at ?? null,
      referralLink: c.referral_code ? `${SITE_URL}/join?ref=${c.referral_code}` : null,
      accountUrl: ACCOUNT_URL,
    });
  } catch (err) {
    console.error(`Welcome email failed for customer ${customerId}:`, err);
  }
}

/** The friend's first visit unlocked `referrerId`'s £5 voucher. */
export async function sendReferralUnlockedFor(referrerId: number, friendId: number): Promise<void> {
  try {
    const [{ data: referrer }, { data: friend }, { data: voucher }] = await Promise.all([
      supabase.from("customers").select("name, email").eq("id", referrerId).single(),
      supabase.from("customers").select("name").eq("id", friendId).single(),
      supabase
        .from("loyalty_redemptions")
        .select("code, expires_at")
        .eq("customer_id", referrerId)
        .eq("referred_customer_id", friendId)
        .eq("status", "issued")
        .maybeSingle(),
    ]);
    if (!referrer?.email || !voucher) return;
    await sendReferralUnlockedEmail(referrer.email, {
      customerName: referrer.name,
      friendName: friend?.name || "Your friend",
      code: voucher.code,
      expiresAt: voucher.expires_at,
      accountUrl: ACCOUNT_URL,
    });
  } catch (err) {
    console.error(`Referral-unlocked email failed (referrer ${referrerId}):`, err);
  }
}

const shiftDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Member = { id: number; name: string; email: string | null; marketing_consent: boolean; loyalty_points: number; nudge_sent_at?: string | null };

/**
 * Daily (morning): for yesterday's trading day, each customer who opted in
 * gets one email — a thank-you if it was their FIRST visit (points, balance,
 * welcome voucher, review link), otherwise the usual "how was your meal?"
 * review request (only when a Google review link is set). Then the 10-day
 * nudges. Orders are claimed (review_requested_at) and nudges marked
 * (nudge_sent_at) before sending, so a re-run never double-sends.
 */
export async function runDailyMemberEmails(now: Date = new Date()): Promise<{ thankYou: number; review: number; nudge: number }> {
  const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "google_review_url").maybeSingle();
  const reviewUrl = typeof setting?.value === "string" && /^https:\/\//.test(setting.value.trim()) ? setting.value.trim() : null;

  const today = tradingDayStr(now);
  const yesterday = shiftDay(today, -1);
  const { start, end } = tradingRangeUtc(yesterday);

  // ---- yesterday's visitors ----
  const { data: orders } = await supabase
    .from("orders")
    .select("id, customer_id, customers(id, name, email, marketing_consent, loyalty_points)")
    .eq("is_paid", true)
    .is("review_requested_at", null)
    .not("customer_id", "is", null)
    .gte("created_at", start)
    .lte("created_at", end);

  const byCustomer = new Map<number, { member: Member; orderIds: number[] }>();
  for (const o of (orders ?? []) as unknown as { id: number; customer_id: number; customers: Member | null }[]) {
    if (!o.customers?.marketing_consent || !o.customers.email) continue;
    const entry = byCustomer.get(o.customer_id) ?? { member: o.customers, orderIds: [] };
    entry.orderIds.push(o.id);
    byCustomer.set(o.customer_id, entry);
  }

  let thankYou = 0;
  let review = 0;
  for (const [customerId, { member, orderIds }] of byCustomer) {
    // first visit = no paid order of theirs before yesterday's trading day
    const { count: earlier } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .eq("is_paid", true)
      .lt("created_at", start);
    const firstVisit = (earlier ?? 0) === 0;
    if (!firstVisit && !reviewUrl) continue; // nothing to send (leave unclaimed)

    const { data: claimed } = await supabase
      .from("orders")
      .update({ review_requested_at: new Date().toISOString() })
      .in("id", orderIds)
      .is("review_requested_at", null)
      .select("id");
    if (!claimed?.length) continue;

    try {
      if (firstVisit) {
        const { data: earned } = await supabase
          .from("loyalty_transactions")
          .select("points_delta")
          .eq("customer_id", customerId)
          .eq("reference_type", "order")
          .in("reference_id", orderIds)
          .in("reason", [...ORDER_EARN_REASONS, "visit_bonus"]);
        const voucher = await unusedWelcomeVoucher(customerId);
        await sendThankYouEmail(member.email, {
          customerName: member.name,
          pointsEarned: (earned ?? []).reduce((s, r) => s + Number(r.points_delta), 0),
          balance: member.loyalty_points,
          voucherCode: voucher?.code ?? null,
          voucherExpiresAt: voucher?.expires_at ?? null,
          reviewUrl,
          accountUrl: ACCOUNT_URL,
          unsubscribeUrl: unsubscribeUrl(customerId),
        });
        thankYou++;
      } else if (reviewUrl) {
        await sendReviewRequestEmail(member.email, { customerName: member.name, reviewUrl, unsubscribeUrl: unsubscribeUrl(customerId) });
        review++;
      }
    } catch (err) {
      console.error(`After-visit email failed for customer ${customerId}:`, err);
    }
  }

  // ---- 10-day nudges: first visit exactly NUDGE_AFTER_DAYS trading days ago, not back since ----
  const nudgeDay = shiftDay(today, -NUDGE_AFTER_DAYS);
  const nudgeRange = tradingRangeUtc(nudgeDay);
  const { data: thenOrders } = await supabase
    .from("orders")
    .select("customer_id, customers(id, name, email, marketing_consent, loyalty_points, nudge_sent_at)")
    .eq("is_paid", true)
    .not("customer_id", "is", null)
    .gte("created_at", nudgeRange.start)
    .lte("created_at", nudgeRange.end);

  const candidates = new Map<number, Member>();
  for (const o of (thenOrders ?? []) as unknown as { customer_id: number; customers: Member | null }[]) {
    const m = o.customers;
    if (m?.marketing_consent && m.email && !m.nudge_sent_at) candidates.set(o.customer_id, m);
  }

  let nudge = 0;
  const secondVisitBonus = visitBonusFor(2, await getVisitBonusRules());
  for (const [customerId, member] of candidates) {
    const [{ count: before }, { count: since }] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", customerId).eq("is_paid", true).lt("created_at", nudgeRange.start),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", customerId).eq("is_paid", true).gt("created_at", nudgeRange.end),
    ]);
    if ((before ?? 0) > 0 || (since ?? 0) > 0) continue; // not their first visit, or they've been back

    const { data: marked } = await supabase
      .from("customers")
      .update({ nudge_sent_at: new Date().toISOString() })
      .eq("id", customerId)
      .is("nudge_sent_at", null)
      .select("id");
    if (!marked?.length) continue;

    try {
      const voucher = await unusedWelcomeVoucher(customerId);
      await sendNudgeEmail(member.email, {
        customerName: member.name,
        balance: member.loyalty_points,
        secondVisitBonus,
        voucherCode: voucher?.code ?? null,
        voucherExpiresAt: voucher?.expires_at ?? null,
        accountUrl: ACCOUNT_URL,
        unsubscribeUrl: unsubscribeUrl(customerId),
      });
      nudge++;
    } catch (err) {
      console.error(`Nudge email failed for customer ${customerId}:`, err);
    }
  }

  return { thankYou, review, nudge };
}
