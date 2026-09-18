import supabase from "@/lib/supabase";
import { sendPaymentReceiptEmail } from "@/lib/email";

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

// Fired once an order becomes fully paid, from whichever channel it came
// from (POS dine-in, POS takeaway/delivery, or a QR self-order paid at the
// till) — previously nothing was ever sent at payment time on any channel;
// the only confirmation email in the whole app fired at website checkout,
// before payment even happened. Best-effort: never let a failed/unconfigured
// email affect whether the payment itself succeeded.
export async function sendOrderPaymentReceipt(orderId: number): Promise<void> {
  try {
    const { data: order } = await supabase
      .from("orders")
      .select("order_number, customer_name, customer_email, order_type, subtotal, discount, tax, service_charge_amount, total, updated_at, restaurant_tables(table_number)")
      .eq("id", orderId)
      .single();
    if (!order?.customer_email) return;

    const { data: items } = await supabase
      .from("order_items")
      .select("item_name, item_price, quantity, notes")
      .eq("order_id", orderId)
      .neq("status", "cancelled");
    if (!items || items.length === 0) return;

    const { data: payments } = await supabase.from("payments").select("method, amount").eq("order_id", orderId);
    const methodLabel: Record<string, string> = { cash: "Cash", card: "Card", card_online: "Online" };
    const methods = new Set((payments || []).filter((p) => Number(p.amount) > 0).map((p) => methodLabel[p.method] ?? p.method));

    const table = order.restaurant_tables as unknown as { table_number: string } | null;

    await sendPaymentReceiptEmail(order.customer_email, {
      orderNumber: order.order_number,
      customerName: order.customer_name || "Guest",
      tableNumber: table?.table_number ?? null,
      orderType: order.order_type,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      tax: Number(order.tax),
      serviceCharge: Number(order.service_charge_amount),
      total: Number(order.total),
      paymentMethod: [...methods].join(" + ") || "Cash",
      paidAt: order.updated_at,
      items: items.map((i) => ({ name: i.item_name, quantity: i.quantity, unitPrice: Number(i.item_price), notes: i.notes })),
    });
  } catch (err) {
    console.error("Failed to send payment receipt email for order", orderId, err);
  }
}
