import { createHmac, timingSafeEqual } from "crypto";
import supabase from "@/lib/supabase";
import { doublePointsDay, getLoyaltySetting } from "@/lib/loyalty";
import { SITE_URL } from "@/lib/site-url";

// "Claim your points" QR on dine-in receipts that had no member on them: the
// guest scans it, signs up or logs in, and the bill's points land in their
// account. The link carries the order id plus a short HMAC so nobody can
// claim someone else's bill by guessing ids — no extra table needed, and
// "one claim per receipt" falls out of orders.customer_id being set.

export const CLAIM_WINDOW_DAYS = 7;

const SECRET = process.env.JWT_SECRET || "royal-chilli-pos-fallback-secret-key-2024";

export function claimKey(orderId: number): string {
  return createHmac("sha256", SECRET).update(`claim:${orderId}`).digest("base64url").slice(0, 12);
}

export function claimUrl(orderId: number): string {
  return `${SITE_URL}/claim?o=${orderId}&k=${claimKey(orderId)}`;
}

export function claimKeyValid(orderId: number, key: string): boolean {
  const expected = Buffer.from(claimKey(orderId));
  const given = Buffer.from(String(key || ""));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** When the bill was settled — its last payment. Decides Tue–Thu doubling. */
export async function paidAtFor(orderId: number): Promise<Date> {
  const { data } = await supabase
    .from("payments")
    .select("created_at")
    .eq("order_id", orderId)
    .gt("amount", 0)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.created_at ? new Date(data.created_at) : new Date();
}

/** Points this bill earns — same maths as awardPurchasePoints (base, doubled Tue–Thu). */
export async function pointsForBill(businessId: number, total: number, paidAt: Date): Promise<number> {
  const rate = (await getLoyaltySetting(businessId, "loyalty_points_per_pound", 1)) || 1;
  const base = Math.floor(total * rate);
  return (await doublePointsDay(businessId, paidAt)) ? base * 2 : base;
}

export type ClaimableOrder = { id: number; total: number; orderNumber: string; paidAt: Date; points: number };

/**
 * Whether this receipt can still be claimed: a paid dine-in bill, no member
 * on it yet, within 7 days. Returns the bill or a reason it can't be.
 */
export async function claimableOrder(orderId: number, key: string): Promise<{ ok: true; order: ClaimableOrder } | { ok: false; error: string }> {
  if (!orderId || !claimKeyValid(orderId, key)) return { ok: false, error: "This link isn't valid — check you scanned the whole QR code." };
  const { data: o } = await supabase
    .from("orders")
    .select("id, business_id, order_number, order_type, total, customer_id, is_paid, status, created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return { ok: false, error: "We couldn't find that bill." };
  if (o.customer_id) return { ok: false, error: "The points for this bill have already been claimed." };
  if (!o.is_paid || o.status === "cancelled" || o.order_type !== "dine_in") return { ok: false, error: "This bill can't earn points." };
  if (Date.now() - new Date(o.created_at).getTime() > CLAIM_WINDOW_DAYS * 24 * 3600 * 1000) {
    return { ok: false, error: `Points can only be claimed within ${CLAIM_WINDOW_DAYS} days of your visit.` };
  }
  const { count: refunds } = await supabase.from("payments").select("id", { count: "exact", head: true }).eq("order_id", o.id).lt("amount", 0);
  if ((refunds ?? 0) > 0) return { ok: false, error: "This bill was refunded, so it can't earn points." };
  const paidAt = await paidAtFor(o.id);
  return {
    ok: true,
    order: { id: o.id, total: Number(o.total), orderNumber: o.order_number, paidAt, points: await pointsForBill(o.business_id, Number(o.total), paidAt) },
  };
}
