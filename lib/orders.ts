import supabase from "@/lib/supabase";
import { sendPaymentReceiptEmail, sendOrderCancellationEmail } from "@/lib/email";

// Cancelling an order and freeing its table are always done together — a
// cancelled order shouldn't leave the table stuck "occupied", and a table
// shouldn't be freed while an order against it is still open. Shared by an
// explicit whole-order cancel and by voiding the last remaining item on a
// dine-in order down to nothing.
//
// Refused once an order is already paid — cancelling wouldn't touch the
// money already taken or the loyalty points already awarded for it (only
// the dedicated Refund flow reverses both of those). Staff need to use
// Refund instead so those stay in sync.
export async function cancelOrderAndFreeTable(orderId: number, tableId: number | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: order } = await supabase
    .from("orders")
    .select("status, order_number, customer_name, customer_email, customers(email)")
    .eq("id", orderId)
    .single();

  if (order?.status === "paid") {
    return { ok: false, error: "This order is already paid — cancel it through Refund instead, so the payment and any loyalty points get reversed too." };
  }

  await supabase.from("orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", orderId);
  if (tableId) {
    await supabase.from("restaurant_tables").update({ status: "available", self_order_enabled: false }).eq("id", tableId);
  }

  if (order) {
    try {
      const linkedCustomer = order.customers as unknown as { email: string | null } | null;
      const recipientEmail = order.customer_email || linkedCustomer?.email;
      if (recipientEmail) {
        const { data: items } = await supabase.from("order_items").select("item_name, quantity").eq("order_id", orderId);
        if (items && items.length > 0) {
          await sendOrderCancellationEmail(recipientEmail, {
            orderNumber: order.order_number,
            customerName: order.customer_name || "Guest",
            items: items.map((i) => ({ name: i.item_name, quantity: i.quantity })),
          });
        }
      }
    } catch (err) {
      console.error("Failed to send cancellation email for order", orderId, err);
    }
  }

  return { ok: true };
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
      .select("order_number, customer_id, customer_name, customer_email, order_type, subtotal, discount, tax, service_charge_amount, total, updated_at, restaurant_tables(table_number), customers(email, loyalty_points)")
      .eq("id", orderId)
      .single();
    if (!order) return;
    // orders.customer_email is only ever set by the website's own checkout
    // — dine-in/QR/POS capture an email onto the linked customers row
    // instead, so that's the reliable source here.
    const linkedCustomer = order.customers as unknown as { email: string | null; loyalty_points: number } | null;
    const recipientEmail = order.customer_email || linkedCustomer?.email;
    if (!recipientEmail) return;

    // Points this specific order earned — read back from the ledger rather
    // than recomputed, since awardPurchasePoints (called just before this,
    // in the payment route) has already posted the real amount.
    let loyalty: { pointsEarned: number; newBalance: number } | undefined;
    if (order.customer_id && linkedCustomer) {
      const { data: earnRows } = await supabase
        .from("loyalty_transactions")
        .select("points_delta")
        .eq("reference_type", "order")
        .eq("reference_id", orderId)
        .in("reason", ["earned_purchase", "tier_bonus"]);
      const pointsEarned = (earnRows || []).reduce((s, r) => s + Number(r.points_delta), 0);
      if (pointsEarned > 0) {
        loyalty = { pointsEarned, newBalance: linkedCustomer.loyalty_points };
      }
    }

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

    await sendPaymentReceiptEmail(recipientEmail, {
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
      loyalty,
    });
  } catch (err) {
    console.error("Failed to send payment receipt email for order", orderId, err);
  }
}
