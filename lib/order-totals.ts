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

// The single place bill math happens — subtotal -> VAT -> discount -> service
// charge -> total. Tip is deliberately not here: it's per-payment, never part
// of the bill total (see PaymentModal.tsx / payments.tip_amount).
//
// Order of operations (confirmed with the owner): VAT is added to the
// subtotal FIRST, then the discount is taken off that VAT-inclusive figure,
// then service charge is calculated on what's left.
export function computeBill(input: BillInput): BillBreakdown {
  const subtotal = round2(input.subtotal);
  const tax = round2(subtotal * 0.2);
  const subtotalWithTax = round2(subtotal + tax);

  let discount = 0;
  if (input.discountType === "percent" && input.discountPct != null) {
    discount = round2(subtotalWithTax * (input.discountPct / 100));
  } else {
    discount = round2(input.discountAmount || 0);
  }
  discount = Math.max(0, Math.min(discount, subtotalWithTax));

  const discounted = round2(subtotalWithTax - discount);
  const serviceChargeAmount = round2(discounted * (input.serviceChargePct / 100));
  const total = round2(discounted + serviceChargeAmount);

  return { subtotal, tax, subtotalWithTax, discount, discounted, serviceChargeAmount, total };
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
