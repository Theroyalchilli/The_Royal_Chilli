import supabase from "@/lib/supabase";

export async function recalcTotals(orderId: string) {
  const { data: orderData } = await supabase
    .from("orders")
    .select("discount, service_charge_pct")
    .eq("id", orderId)
    .single();
  const discount = orderData?.discount ?? 0;
  const serviceChargePct = orderData?.service_charge_pct ?? 0;

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
  const taxable = subtotal - discount;
  const tax = Math.round(taxable * 0.2 * 100) / 100;
  const serviceChargeAmount = Math.round(taxable * (serviceChargePct / 100) * 100) / 100;
  const total = Math.round((taxable + tax + serviceChargeAmount) * 100) / 100;

  await supabase
    .from("orders")
    .update({ subtotal, tax, service_charge_amount: serviceChargeAmount, total, updated_at: new Date().toISOString() })
    .eq("id", orderId);
}
