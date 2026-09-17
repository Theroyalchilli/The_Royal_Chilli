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

// Based on the highest sequence number actually issued today, not a row
// COUNT — a COUNT drifts (and starts reissuing already-used numbers, which
// then collide on the unique constraint and block every new order for the
// rest of the day) the moment any of today's orders is deleted rather than
// just cancelled, e.g. test-data cleanup against production.
export async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `RC-${dateStr}-`;
  const todayStart = now.toISOString().slice(0, 10) + "T00:00:00.000Z";
  const todayEnd = now.toISOString().slice(0, 10) + "T23:59:59.999Z";

  const { data: rows } = await supabase
    .from("orders")
    .select("order_number")
    .gte("created_at", todayStart)
    .lte("created_at", todayEnd)
    .like("order_number", `${prefix}%`);

  let maxSeq = 0;
  for (const r of rows ?? []) {
    const n = parseInt(String(r.order_number).slice(prefix.length), 10);
    if (!isNaN(n) && n > maxSeq) maxSeq = n;
  }

  const seq = (maxSeq + 1).toString().padStart(3, "0");
  return `${prefix}${seq}`;
}
