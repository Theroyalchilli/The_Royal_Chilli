import supabase from "@/lib/supabase";

/**
 * Put a member on a bill (and any rounds merged into it) so the points post
 * when it's paid. Only unpaid bills — a paid one is claimed from its receipt
 * instead — and never one already linked to someone else.
 */
export async function linkMemberToOrders(
  customerId: number,
  orderIds: number[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (orderIds.length === 0) return { ok: true };
  const { data: orders } = await supabase.from("orders").select("id, is_paid, customer_id, status").in("id", orderIds);
  for (const o of orders ?? []) {
    if (o.is_paid || o.status === "cancelled") return { ok: false, error: "This bill is already paid — they can claim the points from the receipt QR instead" };
    if (o.customer_id && o.customer_id !== customerId) {
      // A silent guest row from an earlier phone capture is fine to replace;
      // a real member isn't.
      const { data: other } = await supabase.from("customers").select("name").eq("id", o.customer_id).maybeSingle();
      if (other && other.name && other.name !== "Guest") {
        return { ok: false, error: `This bill is already linked to ${other.name}` };
      }
    }
  }
  const { data: c } = await supabase.from("customers").select("name, phone").eq("id", customerId).single();
  const { error } = await supabase
    .from("orders")
    .update({ customer_id: customerId, customer_name: c?.name ?? null, customer_phone: c?.phone ?? null, updated_at: new Date().toISOString() })
    .in("id", orderIds)
    .eq("is_paid", false);
  if (error) return { ok: false, error: "Couldn't link the member" };
  return { ok: true };
}
