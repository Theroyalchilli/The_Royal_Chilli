import { getCustomerSession } from "@/lib/customer-auth";
import supabase from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

type Order = {
  id: number;
  order_number: string;
  order_type: string;
  status: string;
  total: number;
  scheduled_for: string | null;
  created_at: string;
};

const statusLabel: Record<string, string> = {
  open: "Preparing your order",
  sent_to_kitchen: "In the kitchen",
  ready: "Ready",
  paid: "Completed",
};

const typeLabel: Record<string, string> = {
  dine_in: "🍽️ Dine-in",
  takeaway: "🥡 Takeaway",
  delivery: "🛵 Delivery",
  online: "🌐 Online",
};

function OrderRow({ order }: { order: Order }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 text-sm">
      <div>
        <div className="font-medium">
          {order.order_number} <span className="text-muted-foreground">· {typeLabel[order.order_type] || order.order_type}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {new Date(order.scheduled_for || order.created_at).toLocaleString("en-GB", {
            weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
          })}
          {order.scheduled_for && " (scheduled)"}
          {" · "}
          {statusLabel[order.status] || order.status}
        </div>
      </div>
      <div className="font-semibold text-primary">{formatCurrency(order.total)}</div>
    </div>
  );
}

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
      {(upcoming || []).length > 0 && (
        <div className="mb-8">
          <h2 className="font-[family-name:var(--font-playfair)] text-xl text-primary">Upcoming</h2>
          <div className="mt-2">
            {(upcoming || []).map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        </div>
      )}

      <h2 className="font-[family-name:var(--font-playfair)] text-xl text-primary">History</h2>
      {(history || []).length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No past orders yet.</p>
      ) : (
        <div className="mt-2">
          {(history || []).map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}
