import supabase from "@/lib/supabase";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type DiscountType = "percent" | "amount" | null;

export interface BillInput {
  subtotal: number;
  discountType: DiscountType;
  discountPct: number | null;
  // The order's stored `discount` column. Used as-is (clamped only) when
  // discountType isn't "percent" — it's the raw flat amount staff chose, and
  // must never be silently overwritten by a clamp (e.g. items voided,
  // subtotal shrinks below it) or the original intent is lost for good.
  discountAmount: number;
  serviceChargePct: number;
}

export interface BillBreakdown {
  subtotal: number;
  tax: number;
  subtotalWithTax: number;
  discount: number;
  discounted: number;
  serviceChargeAmount: number;
  total: number;
}

// The single place bill math happens — subtotal -> discount -> service
// charge -> total. Tip is deliberately not here: it's per-payment, never part
// of the bill total (see PaymentModal.tsx / payments.tip_amount).
//
// Menu/item prices are VAT-INCLUSIVE — the number a customer sees (till or
// online) is exactly what they pay, standard for a UK consumer-facing menu.
// `subtotal` therefore already includes VAT; there is no additive VAT step.
// `tax` is reported for receipts/VAT-return purposes only — the 20% VAT
// component *embedded in* the final total (total - total/1.2), extracted
// after discount and service charge, never added on top of what's shown.
export function computeBill(input: BillInput): BillBreakdown {
  const subtotal = round2(input.subtotal);

  let discount = 0;
  if (input.discountType === "percent" && input.discountPct != null) {
    discount = round2(subtotal * (input.discountPct / 100));
  } else {
    discount = round2(input.discountAmount || 0);
  }
  discount = Math.max(0, Math.min(discount, subtotal));

  const discounted = round2(subtotal - discount);
  const serviceChargeAmount = round2(discounted * (input.serviceChargePct / 100));
  const total = round2(discounted + serviceChargeAmount);
  const tax = round2(total - total / 1.2);

  // subtotalWithTax kept for shape-compatibility with existing callers —
  // there's no separate "with tax" figure any more since subtotal already
  // includes it, so this is just subtotal itself.
  return { subtotal, tax, subtotalWithTax: subtotal, discount, discounted, serviceChargeAmount, total };
}

export async function recalcTotals(orderId: string) {
  const { data: orderData } = await supabase
    .from("orders")
    .select("discount, discount_type, discount_pct, service_charge_pct")
    .eq("id", orderId)
    .single();

  // Sum only active (non-cancelled) items
  const { data: activeItems } = await supabase
    .from("order_items")
    .select("item_price, quantity")
    .eq("order_id", orderId)
    .neq("status", "cancelled");

  const subtotal = (activeItems ?? []).reduce(
    (s: number, i: { item_price: number; quantity: number }) => s + i.item_price * i.quantity,
    0
  );

  const bill = computeBill({
    subtotal,
    discountType: (orderData?.discount_type as DiscountType) ?? null,
    discountPct: orderData?.discount_pct ?? null,
    discountAmount: orderData?.discount ?? 0,
    serviceChargePct: orderData?.service_charge_pct ?? 0,
  });

  const updatePayload: Record<string, unknown> = {
    subtotal: bill.subtotal,
    tax: bill.tax,
    service_charge_amount: bill.serviceChargeAmount,
    total: bill.total,
    updated_at: new Date().toISOString(),
  };
  // Only refresh the stored `discount` for percent-type discounts, where
  // it's purely a derived display cache. For a flat-amount discount, leave
  // it exactly as staff set it — the clamp above only affects this bill's
  // total, never the stored rule.
  if (orderData?.discount_type === "percent") {
    updatePayload.discount = bill.discount;
  }

  await supabase.from("orders").update(updatePayload).eq("id", orderId);
  return bill;
}
