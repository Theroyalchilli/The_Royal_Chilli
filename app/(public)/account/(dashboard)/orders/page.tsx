import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-auth";
import supabase from "@/lib/supabase";
import AccountOrderCard, { type AccountOrder } from "@/components/site/AccountOrderCard";

export default async function AccountOrdersPage() {
  const session = await getCustomerSession();
  if (!session) return null; // layout already redirects

  const { data: upcoming } = await supabase
    .from("orders")
    .select("id, order_number, order_type, status, total, scheduled_for, created_at")
    .eq("customer_id", session.id)
    .in("status", ["open", "sent_to_kitchen", "ready"])
    .order("created_at", { ascending: false });

  const { data: history } = await supabase
    .from("orders")
    .select("id, order_number, order_type, status, total, scheduled_for, created_at")
    .eq("customer_id", session.id)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-playfair)] text-2xl">Orders</h1>
      <Link
        href="/order"
        className="mt-3.5 block w-full rounded-xl bg-primary py-3 text-center text-sm font-bold text-primary-foreground hover:opacity-90"
      >
        Start a new order
      </Link>

      <div className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Upcoming &amp; pre-orders</div>
      <div className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
        {(upcoming || []).length > 0 ? (
          (upcoming as AccountOrder[]).map((o) => <AccountOrderCard key={o.id} order={o} />)
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <span className="mb-1.5 block text-2xl">🕒</span>
            No upcoming or pre-orders.
          </div>
        )}
      </div>

      <div className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Order history</div>
      <div className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
        {(history || []).length > 0 ? (
          (history as AccountOrder[]).map((o) => <AccountOrderCard key={o.id} order={o} />)
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <span className="mb-1.5 block text-2xl">🧾</span>
            No past orders yet.
          </div>
        )}
      </div>
    </div>
  );
}
