import { getCustomerSession } from "@/lib/customer-auth";
import supabase from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

// Plain stats for now — the points balance becomes a proper donut once the
// Loyalty/Scan & Pay tab (Phase 4) gives it something to show progress
// toward (redeemable chunk, tier, etc.) rather than just a bare number.
export default async function AccountOverviewPage() {
  const session = await getCustomerSession();
  if (!session) return null; // layout already redirects; this satisfies TS

  const { data: customer } = await supabase
    .from("customers")
    .select("loyalty_points, created_at")
    .eq("id", session.id)
    .maybeSingle();

  const { count: orderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", session.id)
    .eq("status", "paid");

  const { data: paidOrders } = await supabase
    .from("orders")
    .select("total")
    .eq("customer_id", session.id)
    .eq("status", "paid");
  const lifetimeSpend = (paidOrders || []).reduce((sum, o) => sum + Number(o.total), 0);

  const memberSince = customer?.created_at
    ? new Date(customer.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : null;

  const stats = [
    { label: "Loyalty Points", value: (customer?.loyalty_points ?? 0).toLocaleString() },
    { label: "Orders Placed", value: String(orderCount ?? 0) },
    { label: "Lifetime Spend", value: formatCurrency(lifetimeSpend) },
  ];

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="border border-border px-3 py-5 text-center">
            <div className="font-[family-name:var(--font-playfair)] text-2xl text-primary">{s.value}</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
      {memberSince && (
        <p className="mt-6 text-center text-sm text-muted-foreground">Member since {memberSince}</p>
      )}
    </div>
  );
}
