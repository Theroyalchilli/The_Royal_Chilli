import { formatCurrency } from "@/lib/utils";

export type AccountOrder = {
  id: number;
  order_number: string;
  order_type: string;
  status: string;
  total: number;
  scheduled_for: string | null;
  created_at: string;
};

const statusLabel: Record<string, string> = {
  open: "Preparing",
  sent_to_kitchen: "In the kitchen",
  ready: "Ready",
  paid: "Completed",
};
const statusTone: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-600",
  sent_to_kitchen: "bg-amber-500/10 text-amber-600",
  ready: "bg-emerald-500/10 text-emerald-600",
  paid: "bg-muted text-muted-foreground",
};
const typeLabel: Record<string, string> = {
  dine_in: "🍽️ Dine-in",
  takeaway: "🥡 Collection",
  delivery: "🛵 Delivery",
  online: "🌐 Online",
};

export default function AccountOrderCard({ order }: { order: AccountOrder }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-3.5 text-sm last:border-b-0">
      {/* min-w-0 lets this side wrap/shrink instead of forcing the row wider
          than the price column can absorb — without it, a flex child with
          no explicit width refuses to shrink below its content's natural
          size, which is exactly what pushes a row into horizontal overflow. */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
          <span className="break-all">{order.order_number}</span>
          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${statusTone[order.status] || "bg-muted text-muted-foreground"}`}>
            {statusLabel[order.status] || order.status}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {typeLabel[order.order_type] || order.order_type} ·{" "}
          {new Date(order.scheduled_for || order.created_at).toLocaleString("en-GB", {
            weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
          })}
          {order.scheduled_for && " (scheduled)"}
        </div>
      </div>
      <div className="flex-shrink-0 font-semibold text-primary">{formatCurrency(order.total)}</div>
    </div>
  );
}
