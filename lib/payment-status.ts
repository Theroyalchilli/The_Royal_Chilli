// Whether an order has been paid, judged by the money received — not by
// orders.status. An order paid online (Stripe) stays "sent_to_kitchen" /
// "ready" while the kitchen works on it; only a till payment moves it to
// "paid". Checking status alone let paid online orders be cancelled without a
// refund and printed "UNPAID" receipts. Safe to import in the browser.

type Money = { status?: string | null; total: number | string; amount_paid: number | string | null };

const PENNY = 0.009;

export function isFullyPaid(order: Money): boolean {
  if (order.status === "paid") return true;
  const total = Number(order.total);
  return total > 0 && Number(order.amount_paid || 0) >= total - PENNY;
}

// Money currently held against the order (payments minus refunds).
export function amountHeld(order: Money): number {
  const paid = Number(order.amount_paid || 0);
  return paid > PENNY ? Math.round(paid * 100) / 100 : 0;
}

// One word for the money side of an order, for History badges and receipts.
// `refunded` is the total handed back (refund rows are negative payments);
// amount_paid is already net of it. A full refund of an order that was paid
// reads "refunded", not "unpaid" — nothing is owed.
export type PaymentState = "paid" | "part_paid" | "unpaid" | "refunded" | "part_refunded";

export function paymentState(order: Money, refunded: number): PaymentState {
  const held = amountHeld(order);
  if (refunded > PENNY) return held > PENNY ? "part_refunded" : "refunded";
  if (isFullyPaid(order)) return "paid";
  return held > PENNY ? "part_paid" : "unpaid";
}

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  paid: "Paid",
  part_paid: "Part paid",
  unpaid: "Unpaid",
  refunded: "Refunded",
  part_refunded: "Part refunded",
};
