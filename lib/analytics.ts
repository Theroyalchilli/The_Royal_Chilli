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
