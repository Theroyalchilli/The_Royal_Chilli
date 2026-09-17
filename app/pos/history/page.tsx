"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { toDateInputValue } from "@/lib/hours";

interface OrderRow {
  id: number;
  order_number: string;
  order_type: "dine_in" | "takeaway" | "delivery";
  status: string;
  total: number;
  amount_paid: number;
  subtotal: number;
  tax?: number;
  table_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  staff_id: number | null;
  staff_name?: string | null;
  created_at: string;
}

interface OrderItem {
  id: number;
  item_name: string;
  item_price: number;
  quantity: number;
  notes?: string;
  status: string;
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  open:            { label: "Open",       color: "text-blue-700",    bg: "bg-blue-500/10 border-blue-500/40" },
  sent_to_kitchen: { label: "Sent",       color: "text-blue-700",    bg: "bg-blue-500/10 border-blue-500/40" },
  ready:           { label: "Ready",      color: "text-emerald-700", bg: "bg-emerald-500/10 border-emerald-500/40" },
  paid:            { label: "Paid",       color: "text-emerald-700", bg: "bg-emerald-500/10 border-emerald-500/40" },
  cancelled:       { label: "Cancelled",  color: "text-red-600",     bg: "bg-red-50 border-red-300" },
};

type CategoryFilter = "all" | "dine_in" | "takeaway" | "delivery" | "online";

function todayStr() {
  return toDateInputValue(new Date());
}

// Mirrors the categorization already used live in the POS (Dine-in /
// Takeaway / Delivery / Online tabs) — "Online" isn't its own order_type in
// the database, it's a takeaway/delivery order with no staff_id because a
// customer placed it on the website rather than a till.
function matchesCategory(order: OrderRow, category: CategoryFilter): boolean {
  if (category === "all") return true;
  if (category === "online") return (order.order_type === "takeaway" || order.order_type === "delivery") && !order.staff_id;
  if (category === "takeaway") return order.order_type === "takeaway" && !!order.staff_id;
  if (category === "delivery") return order.order_type === "delivery" && !!order.staff_id;
  return order.order_type === category;
}

export default function HistoryPage() {
  const router = useRouter();
  const [date, setDate] = useState(todayStr());
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<number, OrderItem[]>>({});

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?date=${date}`, { cache: "no-store" });
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const fetchItems = async (orderId: number) => {
    if (itemsCache[orderId]) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/items`);
      const data = await res.json();
      setItemsCache(prev => ({ ...prev, [orderId]: data.items || [] }));
    } catch { /* silent */ }
  };

  const toggleExpand = (orderId: number) => {
    if (expanded === orderId) { setExpanded(null); return; }
    setExpanded(orderId);
    fetchItems(orderId);
  };

  const q = search.trim().toLowerCase();
  const filtered = orders
    .filter(o => matchesCategory(o, category))
    .filter(o =>
      !q ||
      o.order_number.toLowerCase().includes(q) ||
      (o.customer_name || "").toLowerCase().includes(q) ||
      (o.customer_phone || "").toLowerCase().includes(q) ||
      (o.table_number || "").toLowerCase().includes(q)
    );

  const dayTotal = filtered.filter(o => o.status !== "cancelled").reduce((s, o) => s + Number(o.total), 0);

  const categories: { key: CategoryFilter; label: string; icon: string }[] = [
    { key: "all",      label: "All",      icon: "📋" },
    { key: "dine_in",  label: "Dine-in",  icon: "🍽️" },
    { key: "takeaway", label: "Takeaway", icon: "🥡" },
    { key: "delivery", label: "Delivery", icon: "🛵" },
    { key: "online",   label: "Online",   icon: "🌐" },
  ];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-surface px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/pos")}
          className="text-muted-foreground hover:text-foreground text-sm font-semibold no-select">
          ← Back
        </button>
        <h1 className="text-foreground font-bold text-lg flex-1">📜 Order History</h1>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Shown total</div>
          <div className="text-foreground font-black">{formatCurrency(dayTotal)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 border-b border-border bg-surface px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={e => setDate(e.target.value)}
            className="h-10 border border-border bg-background rounded-lg px-3 text-sm outline-none focus:border-red-500 [color-scheme:light]"
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search order #, name, phone, table…"
            className="h-10 flex-1 min-w-[200px] border border-border bg-background rounded-lg px-3 text-sm outline-none focus:border-red-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors no-select ${
                category === c.key
                  ? "bg-red-600 border-red-600 text-white"
                  : "bg-surface-hover border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm animate-pulse">
            Loading orders…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
            <span className="text-3xl">📭</span>
            <p className="text-sm">No orders match</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl mx-auto">
            {filtered.map(order => {
              const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.open;
              const isOpen = expanded === order.id;
              const items = itemsCache[order.id] || [];
              const isOnline = (order.order_type === "takeaway" || order.order_type === "delivery") && !order.staff_id;
              const typeLabel = order.order_type === "dine_in" ? `Table ${order.table_number ?? "?"}` : order.order_type === "delivery" ? "Delivery" : "Takeaway";

              return (
                <div key={order.id} className={`rounded-xl border overflow-hidden transition-all ${cfg.bg}`}>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left no-select"
                    onClick={() => toggleExpand(order.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-foreground font-bold text-sm">
                          {order.order_type === "dine_in" ? typeLabel : (order.customer_name || "Guest")}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        {isOnline && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-purple-500/15 border-purple-500/40 text-purple-700">
                            🌐 Online
                          </span>
                        )}
                        {order.order_type !== "dine_in" && (
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {order.order_type === "delivery" ? "🛵 Delivery" : "🥡 Takeaway"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">{order.order_number}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(order.created_at).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}
                        </span>
                        {order.staff_name && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-[11px] text-muted-foreground">{order.staff_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-foreground font-black text-sm">{formatCurrency(order.total)}</div>
                      <div className="text-muted-foreground text-[10px]">{isOpen ? "▲" : "▼"}</div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/5 px-4 pb-4 pt-2 space-y-2">
                      {order.customer_phone && (
                        <div className="text-[11px] text-muted-foreground">
                          📞 <a href={`tel:${order.customer_phone}`} className="text-blue-600 hover:underline">{order.customer_phone}</a>
                        </div>
                      )}
                      {items.length === 0 ? (
                        <p className="text-muted-foreground text-xs animate-pulse">Loading items…</p>
                      ) : (
                        <div className="space-y-1">
                          {items.map(item => (
                            <div key={item.id} className={`flex items-center justify-between gap-2 ${item.status === "cancelled" ? "opacity-50 line-through" : ""}`}>
                              <span className="text-xs text-foreground flex-1">
                                <span className="text-foreground font-semibold">{item.quantity}×</span> {item.item_name}
                                {item.notes && <span className="text-muted-foreground"> — {item.notes}</span>}
                              </span>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {formatCurrency(item.item_price * item.quantity)}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between pt-1.5 border-t border-white/5">
                            <span className="text-xs text-muted-foreground">
                              {Number(order.amount_paid) < Number(order.total) && order.status !== "cancelled"
                                ? `Paid ${formatCurrency(order.amount_paid)} of`
                                : "Total"}
                            </span>
                            <span className="text-sm font-black text-foreground">{formatCurrency(order.total)}</span>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => window.open(`/pos/kitchen/print/${order.id}`, "_blank")}
                        className="w-full h-9 mt-1 bg-surface-hover hover:bg-elevated border border-border text-foreground text-xs font-semibold rounded-lg transition-all no-select flex items-center justify-center gap-2"
                      >
                        🖨️ Reprint Receipt
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
