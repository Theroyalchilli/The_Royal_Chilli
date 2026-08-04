import supabase from "@/lib/supabase";

export function tierFromSpend(lifetimeSpend: number): "Bronze" | "Silver" | "Gold" {
  if (lifetimeSpend >= 500) return "Gold";
  if (lifetimeSpend >= 200) return "Silver";
  return "Bronze";
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

  return { lifetimeSpend, visitCount, favouriteDish, tier: tierFromSpend(lifetimeSpend) };
}
