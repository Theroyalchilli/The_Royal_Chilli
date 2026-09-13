import supabase from "@/lib/supabase";

// Cancelling an order and freeing its table are always done together — a
// cancelled order shouldn't leave the table stuck "occupied", and a table
// shouldn't be freed while an order against it is still open. Shared by an
// explicit whole-order cancel and by voiding the last remaining item on a
// dine-in order down to nothing.
export async function cancelOrderAndFreeTable(orderId: number, tableId: number | null): Promise<void> {
  await supabase.from("orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", orderId);
  if (tableId) {
    await supabase.from("restaurant_tables").update({ status: "available" }).eq("id", tableId);
  }
}

export async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const todayStart = now.toISOString().slice(0, 10) + "T00:00:00.000Z";
  const todayEnd = now.toISOString().slice(0, 10) + "T23:59:59.999Z";

  const { count } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart)
    .lte("created_at", todayEnd);

  const seq = ((count ?? 0) + 1).toString().padStart(3, "0");
  return `RC-${dateStr}-${seq}`;
}
