import { getOrderForPrint } from "@/lib/kot";

// Plain text, not StarPRNT markup or an image — every CloudPRNT-capable
// printer supports text/plain at minimum, and it's the one media type we
// can be confident about without hardware to test against. The printer's
// own firmware handles line width/wrapping for the paper it's loaded with.
export async function formatTicketText(orderId: number): Promise<string | null> {
  const data = await getOrderForPrint(orderId);
  if (!data) return null;
  const { order, items } = data;

  const lines: string[] = [];
  const divider = "------------------------------";

  lines.push("THE ROYAL CHILLI");
  lines.push(order.table_number ? `TABLE ${order.table_number}` : String(order.order_type).toUpperCase());
  lines.push(`Order: ${order.order_number}`);
  lines.push(new Date(order.created_at).toLocaleString("en-GB"));
  if (order.customer_name) lines.push(`Customer: ${order.customer_name}`);
  if (order.customer_phone) lines.push(`Phone: ${order.customer_phone}`);
  if (order.scheduled_for) {
    lines.push(`${order.order_type === "delivery" ? "Delivery" : "Collection"}: ${new Date(order.scheduled_for).toLocaleString("en-GB")}`);
  }
  lines.push(divider);

  for (const item of items) {
    lines.push(`${item.quantity}x ${item.item_name}`);
    if (item.modifiers.length > 0) lines.push(`   - ${item.modifiers.join(", ")}`);
    if (item.notes) lines.push(`   ** ${item.notes}`);
  }

  lines.push(divider);
  const isPaid = Number(order.amount_paid) >= Number(order.total);
  lines.push(`TOTAL: GBP ${Number(order.total).toFixed(2)}`);
  // Printed the moment the order lands, which can be seconds before an
  // online payment (a separate follow-up step) actually completes — so
  // this can't assert "unpaid" as fact, just what to do either way.
  lines.push(isPaid ? "STATUS: PAID ONLINE" : `IF NOT ALREADY PAID ONLINE, CHARGE GBP ${(Number(order.total) - Number(order.amount_paid)).toFixed(2)} ON SUMUP`);
  lines.push(divider);
  lines.push(`Printed ${new Date().toLocaleTimeString("en-GB")}`);
  lines.push("");
  lines.push("");
  lines.push("");

  return lines.join("\n");
}
