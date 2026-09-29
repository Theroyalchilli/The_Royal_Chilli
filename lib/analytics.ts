import supabase from "@/lib/supabase";
import { bizDb } from "@/lib/business-db";
import { tradingRangeUtc } from "@/lib/london-date";

export async function getPaidOrdersInRange(businessId: number, from: string, to: string) {
  const { data, error } = await bizDb(businessId)
    .from("orders")
    .select("id, total, staff_id, created_at")
    .eq("is_paid", true)
    .gte("created_at", tradingRangeUtc(from).start)
    .lte("created_at", tradingRangeUtc(to).end);
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
