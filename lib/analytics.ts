import supabase from "@/lib/supabase";

export async function getPaidOrdersInRange(from: string, to: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, total, staff_id, created_at")
    .eq("status", "paid")
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`);
  if (error) throw error;
  return data || [];
}

// Refunded amount per order (positive numbers, summed from the negative
// `payments` rows a refund inserts) — subtract this from `orders.total` to
// get what an order actually netted, since a refund never touches `total`
// itself. Used to keep revenue dashboards from still counting a refunded
// order at its full original value.
export async function getRefundsByOrderId(orderIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (orderIds.length === 0) return map;
  const { data, error } = await supabase
    .from("payments")
    .select("order_id, amount")
    .in("order_id", orderIds)
    .lt("amount", 0);
  if (error) throw error;
  for (const p of data || []) {
    map.set(p.order_id, (map.get(p.order_id) || 0) + Math.abs(Number(p.amount)));
  }
  return map;
}

export async function getItemSalesInRange(orderIds: number[]) {
  if (orderIds.length === 0) return [];
  const { data, error } = await supabase
    .from("order_items")
    .select("menu_item_id, item_name, item_price, quantity")
    .in("order_id", orderIds)
    .neq("status", "cancelled");
  if (error) throw error;
  return data || [];
}
