import supabase from "@/lib/supabase";
import { bizDb } from "@/lib/business-db";
import { tradingDayStr } from "@/lib/london-date";

export type LoyaltyTier = { id: number; name: string; min_lifetime_spend: number; points_multiplier: number };

const tiersCache = new Map<number, { tiers: LoyaltyTier[]; loadedAt: number }>(); // per business
const TIERS_CACHE_MS = 60_000;

// Tiers are admin-configurable (loyalty_tiers table) rather than hardcoded —
// short-lived cache since this is read on every points-earning purchase and
// every customer list load, but tiers themselves change rarely.
export async function getActiveTiers(businessId: number): Promise<LoyaltyTier[]> {
  const cached = tiersCache.get(businessId);
  if (cached && Date.now() - cached.loadedAt < TIERS_CACHE_MS) return cached.tiers;
  const { data } = await bizDb(businessId)
    .from("loyalty_tiers")
    .select("id, name, min_lifetime_spend, points_multiplier")
    .eq("active", 1)
    .order("sort_order", { ascending: true });
  const tiers = (data || []).map((t) => ({ ...t, min_lifetime_spend: Number(t.min_lifetime_spend), points_multiplier: Number(t.points_multiplier) }));
  tiersCache.set(businessId, { tiers, loadedAt: Date.now() });
  return tiers;
}

export function tierForSpend(tiers: LoyaltyTier[], lifetimeSpend: number): LoyaltyTier | null {
  // The qualifying tier is whichever one has the highest threshold the
  // customer's spend still clears — found by comparing thresholds directly,
  // not by assuming the caller passed tiers in a particular order.
  let best: LoyaltyTier | null = null;
  for (const t of tiers) {
    if (lifetimeSpend >= t.min_lifetime_spend && (!best || t.min_lifetime_spend > best.min_lifetime_spend)) {
      best = t;
    }
  }
  if (best) return best;
  // Spend doesn't clear any tier's threshold (e.g. negative) — fall back to
  // whichever configured tier has the lowest threshold.
  return tiers.reduce<LoyaltyTier | null>((lowest, t) => (!lowest || t.min_lifetime_spend < lowest.min_lifetime_spend ? t : lowest), null);
}

/** The business a customer belongs to (every business has its own customers). */
export async function customerBusinessId(customerId: number): Promise<number> {
  const { data, error } = await supabase.from("customers").select("business_id").eq("id", customerId).single();
  if (error || !data) throw error ?? new Error(`Customer ${customerId} not found`);
  return data.business_id as number;
}

export async function tierFromSpend(businessId: number, lifetimeSpend: number): Promise<string> {
  const tiers = await getActiveTiers(businessId);
  return tierForSpend(tiers, lifetimeSpend)?.name ?? "Bronze";
}

// Rewards Club customer groups (phase 5). A "visit" is a trading day with a
// paid order (lib/visits.ts), so two bills in one night are one visit.
export type CustomerSegment = "NEW" | "FIRST_TIME" | "RETURNING" | "REGULAR" | "LAPSED";

export const SEGMENT_LABEL: Record<CustomerSegment, string> = {
  NEW: "New",
  FIRST_TIME: "First-time",
  RETURNING: "Returning",
  REGULAR: "Regular",
  LAPSED: "Lapsed",
};

/** A regular has 5+ visits and has been in within this many days. */
export const REGULAR_WINDOW_DAYS = 60;

// Computed at read-time from visit count and recency — always correct, no
// background job. Lapsed takes priority: a regular who hasn't been in for
// 45+ days (winbackDays) is someone to win back.
//   New        joined, no visits yet
//   First-time 1 visit
//   Returning  2–4 visits
//   Regular    5+ visits, last visit within 60 days
//   Lapsed     visited before, nothing in 45+ days
export function computeSegment(params: { visitCount: number; daysSinceLastVisit: number | null; winbackDays: number }): CustomerSegment {
  const { visitCount, daysSinceLastVisit, winbackDays } = params;
  if (visitCount === 0) return "NEW";
  if (daysSinceLastVisit != null && daysSinceLastVisit > winbackDays) return "LAPSED";
  if (visitCount >= 5 && (daysSinceLastVisit == null || daysSinceLastVisit <= REGULAR_WINDOW_DAYS)) return "REGULAR";
  if (visitCount >= 2) return "RETURNING";
  return "FIRST_TIME";
}

/** Distinct trading days (5am–5am UK) among these paid orders = visits. */
export function countVisits(orders: { created_at: string }[]): number {
  return new Set(orders.map((o) => tradingDayStr(new Date(o.created_at)))).size;
}

export async function getCustomerStats(customerId: number) {
  const { data: orders } = await supabase
    .from("orders")
    .select("id, total, created_at")
    .eq("customer_id", customerId)
    .eq("is_paid", true);

  const lifetimeSpend = Math.round((orders || []).reduce((s, o) => s + Number(o.total), 0) * 100) / 100;
  const visitCount = countVisits(orders || []);

  const orderIds = (orders || []).map((o) => o.id);
  let favouriteDish: string | null = null;
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("item_name, quantity")
      .in("order_id", orderIds)
      .neq("status", "cancelled");
    const countByItem = new Map<string, number>();
    for (const i of items || []) countByItem.set(i.item_name, (countByItem.get(i.item_name) || 0) + i.quantity);
    const sorted = [...countByItem.entries()].sort((a, b) => b[1] - a[1]);
    favouriteDish = sorted[0]?.[0] ?? null;
  }

  return { lifetimeSpend, visitCount, favouriteDish, tier: await tierFromSpend(await customerBusinessId(customerId), lifetimeSpend) };
}
