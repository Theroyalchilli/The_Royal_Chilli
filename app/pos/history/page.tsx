"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { toDateInputValue } from "@/lib/hours";
import PaymentModal from "@/components/pos/PaymentModal";
import type { CartItem } from "@/lib/types";

interface OrderRow {
  id: number;
  order_number: string;
  order_type: "dine_in" | "takeaway" | "delivery";
  status: string;
  total: number;
  amount_paid: number;
  pay_later: boolean;
  subtotal: number;
  tax?: number;
  table_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_id?: number | null;
  staff_id: number | null;
  staff_name?: string | null;
  created_at: string;
  item_count?: number;
  payment_method?: string | null;
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

type CategoryFilter = "all" | "dine_in" | "takeaway" | "delivery" | "online" | "pending";

function todayStr() {
  return toDateInputValue(new Date());
}

function endOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999`);
}

// One row, mutually exclusive. "Online" isn't its own order_type in the
// database, it's a takeaway/delivery order with no staff_id because a
// customer placed it on the website rather than a till. "Pending" cuts
// across every type — any order not yet paid off, regardless of how it
// was ordered or why it's unpaid.
function matchesCategory(order: OrderRow, category: CategoryFilter): boolean {
  if (category === "all") return true;
  if (category === "pending") return order.status !== "paid" && order.status !== "cancelled";
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

  const [payOpen, setPayOpen] = useState(false);
  const [payOrder, setPayOrder] = useState<OrderRow | null>(null);
  const [payItems, setPayItems] = useState<CartItem[]>([]);

  const [refundOrder, setRefundOrder] = useState<OrderRow | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<"cash" | "card" | "card_online">("cash");
  const [refundReason, setRefundReason] = useState("");
  const [refundSaving, setRefundSaving] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [refundNotice, setRefundNotice] = useState("");

  // Pending is the one category that isn't scoped to a single day — it's
  // every unresolved order, full stop. The date field stays live for it
  // (see the `filtered` cutoff below) but the fetch itself pulls everything
  // outstanding regardless of date, since a bill from last week is exactly
  // as "pending" as one from an hour ago.
  const fetchOrders = useCallback(async () => {
    try {
      const url = category === "pending"
        ? `/api/orders?status=open&detailed=true`
        : `/api/orders?date=${date}&detailed=true`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [date, category]);

  // Background refresh doesn't flip `loading` back on (see above) so it
  // can't flash the "Loading orders…" state over someone mid-scroll or
  // mid-refund.
  useEffect(() => {
    setLoading(true);
    fetchOrders();
    const t = setInterval(fetchOrders, 30000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  const fetchItems = async (orderId: number): Promise<OrderItem[]> => {
    if (itemsCache[orderId]) return itemsCache[orderId];
    try {
      const res = await fetch(`/api/orders/${orderId}/items`);
      const data = await res.json();
      const items: OrderItem[] = data.items || [];
      setItemsCache(prev => ({ ...prev, [orderId]: items }));
      return items;
    } catch { return []; }
  };

  const toggleExpand = (orderId: number) => {
    if (expanded === orderId) { setExpanded(null); return; }
    setExpanded(orderId);
    fetchItems(orderId);
  };

  const handleTakePayment = async (order: OrderRow) => {
    const raw = await fetchItems(order.id);
    const cartItems: CartItem[] = raw
      .filter(i => i.status !== "cancelled")
      .map(i => ({
        menu_item_id: 0,
        item_name: i.item_name,
        item_price: i.item_price,
        quantity: i.quantity,
        is_veg: 0,
        sent: true,
        db_id: i.id,
        order_id: order.id,
      }));
    setPayOrder(order);
    setPayItems(cartItems);
    setPayOpen(true);
  };

  const handlePaymentClose = () => {
    setPayOpen(false);
    setPayOrder(null);
    setPayItems([]);
    fetchOrders();
  };

  const openRefund = (order: OrderRow) => {
    setRefundOrder(order);
    setRefundAmount(order.amount_paid.toFixed(2));
    setRefundMethod("cash");
    setRefundReason("");
    setRefundError("");
    setRefundNotice("");
  };

  const closeRefund = () => {
    setRefundOrder(null);
    setRefundAmount("");
    setRefundReason("");
    setRefundError("");
    setRefundNotice("");
  };

  const submitRefund = async () => {
    if (!refundOrder) return;
    setRefundError("");
    setRefundNotice("");
    const amt = parseFloat(refundAmount);
    if (!amt || amt <= 0) { setRefundError("Enter an amount"); return; }
    if (!refundReason.trim()) { setRefundError("A reason is required"); return; }
    setRefundSaving(true);
    try {
      const res = await fetch(`/api/orders/${refundOrder.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, method: refundMethod, reason: refundReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setRefundError(data.error || "Failed to process refund"); return; }
      fetchOrders();
      // Stripe only partially covered the requested amount — keep the modal
      // open on its warning so staff see it before closing, instead of the
      // usual silent close on success.
      if (data.warning) { setRefundNotice(data.warning); return; }
      closeRefund();
    } catch {
      setRefundError("Failed to process refund");
    } finally {
      setRefundSaving(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = orders
    .filter(o => matchesCategory(o, category))
    // Pending's fetch already pulled every unresolved order regardless of
    // date — the date field, for this one category, narrows that down to
    // "still outstanding as of this date" instead of "placed on this date".
    .filter(o => category !== "pending" || new Date(o.created_at) <= endOfDay(date))
    .filter(o =>
      !q ||
      o.order_number.toLowerCase().includes(q) ||
      (o.customer_name || "").toLowerCase().includes(q) ||
      (o.customer_phone || "").toLowerCase().includes(q) ||
      (o.table_number || "").toLowerCase().includes(q)
    );

  const dayTotal = filtered.filter(o => o.status !== "cancelled").reduce((s, o) => s + Number(o.total), 0);

  const clearFilters = () => {
    setCategory("all");
    setSearch("");
  };

  const categories: { key: CategoryFilter; label: string; icon: string }[] = [
    { key: "all",      label: "All",      icon: "📋" },
    { key: "dine_in",  label: "Dine-in",  icon: "🍽️" },
    { key: "takeaway", label: "Takeaway", icon: "🥡" },
    { key: "delivery", label: "Delivery", icon: "🛵" },
    { key: "online",   label: "Online",   icon: "🌐" },
    { key: "pending",  label: "Pending",  icon: "📌" },
  ];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header — title on top, Back button underneath it */}
      <div className="flex-shrink-0 border-b border-border bg-surface px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="text-foreground font-bold text-lg flex-1">📜 Order History</h1>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Shown total</div>
            <div className="text-foreground font-black">{formatCurrency(dayTotal)}</div>
          </div>
        </div>
        <button onClick={() => router.push("/pos")}
          className="mt-2 px-2.5 py-1.5 bg-surface-hover hover:bg-elevated text-foreground text-xs sm:text-sm font-semibold rounded-lg border border-border transition-colors no-select">
          ← Back
        </button>
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
        {category === "pending" && (
          <p className="text-[11px] text-muted-foreground -mt-1">
            Showing every unpaid bill up to {date === todayStr() ? "today" : new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — change the date above to see what was still outstanding as of an earlier day.
          </p>
        )}
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
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
            <span className="text-3xl">📭</span>
            <p className="text-sm">No orders match</p>
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 bg-surface-hover hover:bg-elevated border border-border text-foreground text-xs font-semibold rounded-lg transition-colors no-select"
            >
              Clear filters
            </button>
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
                        {order.pay_later && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-500/15 border-amber-500/40 text-amber-700">
                            📌 Pay Later
                          </span>
                        )}
                        {order.order_type !== "dine_in" && (
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {order.order_type === "delivery" ? "🛵 Delivery" : "🥡 Takeaway"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">{order.order_number}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(order.created_at).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}
                        </span>
                        {typeof order.item_count === "number" && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-[11px] text-muted-foreground">{order.item_count} item{order.item_count === 1 ? "" : "s"}</span>
                          </>
                        )}
                        {order.payment_method && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-[11px] text-muted-foreground">{order.payment_method}</span>
                          </>
                        )}
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

                      <div className="flex gap-2">
                        {order.status !== "paid" && order.status !== "cancelled" && Number(order.amount_paid) < Number(order.total) && (
                          <button
                            onClick={() => handleTakePayment(order)}
                            className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all no-select flex items-center justify-center gap-2"
                          >
                            💰 Take Payment — {formatCurrency(Number(order.total) - Number(order.amount_paid))}
                          </button>
                        )}
                        <button
                          onClick={() => window.open(`/pos/receipt/${order.id}`, "_blank")}
                          className="flex-1 h-9 bg-surface-hover hover:bg-elevated border border-border text-foreground text-xs font-semibold rounded-lg transition-all no-select flex items-center justify-center gap-2"
                        >
                          🖨️ Reprint Receipt
                        </button>
                      </div>
                      {Number(order.amount_paid) > 0 && order.status !== "cancelled" && (
                        <button
                          onClick={() => openRefund(order)}
                          className="w-full h-9 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-700 text-xs font-bold rounded-lg transition-all no-select flex items-center justify-center gap-2"
                        >
                          ↩️ Refund
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {payOrder && (
        <PaymentModal
          open={payOpen}
          onClose={handlePaymentClose}
          orderId={payOrder.id}
          orderNumber={payOrder.order_number}
          customerId={payOrder.customer_id ?? null}
          extraOrderIds={[]}
          items={payItems}
          subtotal={payOrder.subtotal ?? payOrder.total}
          discount={0}
          tax={payOrder.tax ?? Math.round((payOrder.total - payOrder.total / 1.2) * 100) / 100}
          total={payOrder.total}
          amountPaid={payOrder.amount_paid ?? 0}
          onPaymentComplete={fetchOrders}
        />
      )}

      {refundOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={closeRefund}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-3xl mb-2">↩️</div>
              <h2 className="text-foreground font-bold text-lg">Refund {refundOrder.order_number}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Up to {formatCurrency(refundOrder.amount_paid)} paid on this order.</p>
            </div>
            <div className="mt-4 space-y-3">
              <input
                type="number" min="0" max={refundOrder.amount_paid} step="0.01" placeholder="Refund amount (£)"
                value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full bg-surface-hover border border-elevated text-foreground text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-red-500"
              />
              <div className="flex rounded-lg overflow-hidden border border-elevated">
                {(["cash", "card", "card_online"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setRefundMethod(m)}
                    className={`flex-1 py-2 text-xs font-bold transition-all ${refundMethod === m ? "bg-red-600 text-white" : "bg-elevated text-muted-foreground"}`}
                  >
                    {m === "cash" ? "Cash" : m === "card" ? "Card" : "Online"}
                  </button>
                ))}
              </div>
              <input
                type="text" placeholder="Reason — e.g. customer complaint"
                value={refundReason} onChange={(e) => setRefundReason(e.target.value)}
                className="w-full bg-surface-hover border border-elevated text-foreground text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-red-500"
              />
              {refundError && <p className="text-red-600 text-xs text-center">{refundError}</p>}
              {refundNotice && <p className="text-amber-600 text-xs text-center">{refundNotice}</p>}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={closeRefund}
                className="flex-1 h-11 bg-elevated hover:bg-elevated-hover border border-elevated text-foreground font-semibold rounded-xl transition-all"
              >
                {refundNotice ? "Close" : "Cancel"}
              </button>
              {!refundNotice && (
                <button
                  onClick={submitRefund}
                  disabled={refundSaving}
                  className="flex-1 h-11 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
                >
                  {refundSaving ? "Saving…" : "Confirm Refund"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
