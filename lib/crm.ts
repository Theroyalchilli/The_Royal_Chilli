import supabase from "@/lib/supabase";

export type LoyaltyTier = { id: number; name: string; min_lifetime_spend: number; points_multiplier: number };

let tiersCache: { tiers: LoyaltyTier[]; loadedAt: number } | null = null;
const TIERS_CACHE_MS = 60_000;

// Tiers are admin-configurable (loyalty_tiers table) rather than hardcoded —
// short-lived cache since this is read on every points-earning purchase and
// every customer list load, but tiers themselves change rarely.
export async function getActiveTiers(): Promise<LoyaltyTier[]> {
  if (tiersCache && Date.now() - tiersCache.loadedAt < TIERS_CACHE_MS) return tiersCache.tiers;
  const { data } = await supabase
    .from("loyalty_tiers")
    .select("id, name, min_lifetime_spend, points_multiplier")
    .eq("active", 1)
    .order("sort_order", { ascending: true });
  const tiers = (data || []).map((t) => ({ ...t, min_lifetime_spend: Number(t.min_lifetime_spend), points_multiplier: Number(t.points_multiplier) }));
  tiersCache = { tiers, loadedAt: Date.now() };
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

export async function tierFromSpend(lifetimeSpend: number): Promise<string> {
  const tiers = await getActiveTiers();
  return tierForSpend(tiers, lifetimeSpend)?.name ?? "Bronze";
}

export async function getCustomerStats(customerId: number) {
  const { data: orders } = await supabase
    .from("orders")
    .select("id, total, created_at")
    .eq("customer_id", customerId)
    .eq("status", "paid");

  const lifetimeSpend = Math.round((orders || []).reduce((s, o) => s + Number(o.total), 0) * 100) / 100;
  const visitCount = (orders || []).length;

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

  return { lifetimeSpend, visitCount, favouriteDish, tier: await tierFromSpend(lifetimeSpend) };
}
