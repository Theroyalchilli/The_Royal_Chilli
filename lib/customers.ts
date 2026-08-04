import supabase from "@/lib/supabase";

// Finds a customer by phone, or creates one. Used by public checkout/reservation
// and POS order creation so CRM data accumulates from flows that already exist,
// instead of requiring a separate "sign up" step.
export async function findOrCreateCustomerByPhone(phone: string, name: string, email?: string | null): Promise<number | null> {
  const cleanPhone = phone.trim();
  if (!cleanPhone) return null;

  const { data: existing } = await supabase.from("customers").select("id, email").eq("phone", cleanPhone).maybeSingle();
  if (existing) {
    // Backfill email if we now have one and didn't before — never overwrite an existing value.
    if (email && !existing.email) {
      await supabase.from("customers").update({ email }).eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ name: name.trim() || "Guest", phone: cleanPhone, email: email || null })
    .select("id")
    .single();
  if (error) {
    console.error("Customer auto-link error:", error);
    return null;
  }
  return created.id;
}

// 1 point per £1 spent, awarded once a payment is recorded against an order.
export async function awardPurchasePoints(customerId: number, orderTotal: number, orderId: number) {
  const points = Math.floor(orderTotal);
  if (points <= 0) return;
  await supabase.from("loyalty_transactions").insert({
    customer_id: customerId,
    points_delta: points,
    reason: "earned_purchase",
    reference_type: "order",
    reference_id: orderId,
  });
}
