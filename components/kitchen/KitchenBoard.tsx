"use client";

import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from "react";
import Link from "next/link";
import type { Order, OrderItem } from "@/lib/types";
import TableRequestsBanner from "@/components/pos/TableRequestsBanner";
import PrintButton from "@/components/pos/PrintButton";

interface OrderWithItems extends Order {
  items: OrderItem[];
}

function getAgeMinutes(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

const orderTypeIcon: Record<string, string> = {
  dine_in: "🍽️",
  takeaway: "🥡",
  delivery: "🛵",
};

function getOrderCardClass(order: OrderWithItems): string {
  if (order.just_cancelled) return "border-red-600 bg-red-200 animate-pulse";
  if (order.status === "ready") return "border-green-500 bg-green-100";
  if (order.is_modification) return "border-orange-500 bg-orange-100";
  const age = getAgeMinutes(order.created_at);
  if (age >= 20) return "border-red-500 bg-red-100 animate-pulse";
  if (age >= 10) return "border-red-500 bg-red-100";
  return "border-yellow-500 bg-yellow-100 kitchen-new";
}

function getTimerColor(order: OrderWithItems): string {
  if (order.status === "ready") return "text-green-600";
  const age = getAgeMinutes(order.created_at);
  if (age >= 20) return "text-red-600";
  if (age >= 10) return "text-red-600";
  return "text-yellow-600";
}

function orderHasChanges(order: OrderWithItems): boolean {
  return order.items.some((i) => i.status === "cancelled" || (i.original_quantity != null && i.quantity < i.original_quantity));
}

// Every "Send to Kitchen" click is its own order row, so a table that sends
// two rounds (starters, then mains) produces two separate rows that would
// otherwise land wherever their timestamps happen to sort — scattered across
// a busy board instead of read together. Groups consecutive-by-table rows
// into one card, keyed on the table's FIRST round so the group still sorts
// into the board at that round's (oldest, most urgent) position. Cancelled
// alerts and anything without a table (takeaway/delivery) always stand alone.
function groupByTable(list: OrderWithItems[]): OrderWithItems[][] {
  const groups: OrderWithItems[][] = [];
  const indexByTable = new Map<number, number>();
  for (const o of list) {
    if (o.table_id != null && !o.just_cancelled) {
      const idx = indexByTable.get(o.table_id);
      if (idx !== undefined) {
        groups[idx].push(o);
        continue;
      }
      indexByTable.set(o.table_id, groups.length);
    }
    groups.push([o]);
  }
  return groups;
}

const ROTATE_MS = 10_000;

// Fits as many whole rows of the Active grid as actually measure within the
// available height, then pages the rest — instead of a hardcoded "N per
// screen" that would silently start requiring scroll again the day a card
// gets taller (a 3rd round, more items, long notes). A hidden copy of the
// same grid (zero visual footprint — visibility:hidden + height:0, but
// children still lay out and measure normally) is what gets measured; the
// visible grid only ever renders the current page. Multiple pages rotate on
// a timer so nothing needs touching the screen.
function usePaginatedGrid<T>(groups: T[]) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [pages, setPages] = useState<T[][]>([groups]);
  const [page, setPage] = useState(0);

  // A callback ref, not useRef + a mount-only effect — the grid doesn't
  // exist in the DOM yet while `loading` is true (a completely different
  // branch renders), so an effect with `[]` deps reading containerRef.current
  // at that point finds null and never gets another chance to attach: the
  // observer silently never exists for the page's whole lifetime. A callback
  // ref fires whenever React actually attaches the node, however late.
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    if (el) {
      const ro = new ResizeObserver((entries) => setContainerHeight(entries[0].contentRect.height));
      ro.observe(el);
      resizeObserverRef.current = ro;
    }
  }, []);

  useLayoutEffect(() => {
    const measureEl = measureRef.current;
    if (!measureEl || containerHeight === 0 || groups.length === 0) {
      setPages([groups]);
      setPage(0);
      return;
    }
    const cardEls = Array.from(measureEl.children) as HTMLElement[];
    const newPages: T[][] = [];
    let current: T[] = [];
    let i = 0;
    while (i < cardEls.length) {
      const rowTop = cardEls[i].offsetTop;
      let j = i;
      let rowBottom = 0;
      while (j < cardEls.length && cardEls[j].offsetTop === rowTop) {
        rowBottom = Math.max(rowBottom, cardEls[j].offsetTop + cardEls[j].offsetHeight);
        j++;
      }
      if (rowBottom > containerHeight && current.length > 0) {
        newPages.push(current);
        current = [];
      }
      current.push(...groups.slice(i, j));
      i = j;
    }
    if (current.length > 0) newPages.push(current);
    setPages(newPages.length > 0 ? newPages : [groups]);
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, containerHeight]);

  useEffect(() => {
    if (pages.length <= 1) return;
    const id = setInterval(() => setPage((p) => (p + 1) % pages.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [pages.length]);

  return { containerRef, measureRef, page, pageCount: pages.length, visible: pages[page] ?? [] };
}

// One order's header + items + notes + actions — no outer card border, so it
// can be reused standalone (KitchenOrderCard) or stacked as one round inside
// a TableGroupCard.
// One item row — tappable to bump it individually while the order is still
// active. Locked once the order itself is "ready" (whole-order bump/recall
// takes over at that point) so a stray tap can't desync item state from the
// order state that Recall relies on being able to fully undo.
function ItemRow({
  item,
  orderId,
  canBump,
  onBumpItem,
}: {
  item: OrderItem;
  orderId: number;
  canBump: boolean;
  onBumpItem: (orderId: number, itemId: number, status: "ready" | "pending") => void;
}) {
  const [flash, setFlash] = useState(false);
  const cancelled = item.status === "cancelled";
  const bumped = item.status === "ready";
  const qtyReduced = !cancelled && item.original_quantity != null && item.quantity < item.original_quantity;

  const handleClick = () => {
    if (!canBump || cancelled) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
    onBumpItem(orderId, item.id, bumped ? "pending" : "ready");
  };

  return (
    <div
      onClick={handleClick}
      className={`flex items-start gap-2 rounded px-1 -mx-1 py-0.5 ${cancelled ? "opacity-50" : ""} ${flash ? "bump-flash" : ""} ${canBump && !cancelled ? "cursor-pointer active:scale-[0.98] transition-transform" : ""}`}
    >
      <span className={`flex-shrink-0 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
        cancelled
          ? "bg-red-900 text-red-600 line-through"
          : bumped
          ? "bg-green-600 text-white"
          : item.status === "preparing"
          ? "bg-red-600 text-white"
          : "bg-elevated text-foreground"
      }`}>
        {cancelled ? item.quantity : bumped ? "✓" : item.quantity}
      </span>

      <div className="flex-1">
        <div className={`text-sm font-medium leading-tight ${cancelled ? "line-through text-red-600" : bumped ? "line-through text-green-600" : "text-foreground"}`}>
          {item.item_name}
        </div>

        {item.modifiers && item.modifiers.length > 0 && (
          <div className="text-red-600 text-xs">{item.modifiers.join(", ")}</div>
        )}

        {cancelled && (
          <span className="text-[10px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
            ✕ VOIDED BY CASHIER
          </span>
        )}

        {qtyReduced && (
          <span className="text-[10px] font-black text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">
            ↓ QTY: {item.original_quantity} → {item.quantity}
          </span>
        )}

        {item.notes && (
          <div className="text-yellow-600 text-xs italic mt-0.5">⚠ {item.notes}</div>
        )}
      </div>
    </div>
  );
}

function OrderTicketBody({
  order,
  tick,
  onMarkReady,
  onBumpItem,
}: {
  order: OrderWithItems;
  tick: number;
  onMarkReady: (orderId: number) => void;
  onBumpItem: (orderId: number, itemId: number, status: "ready" | "pending") => void;
}) {
  const canBumpItems = order.status === "sent_to_kitchen" && !order.just_cancelled;
  return (
    <>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-foreground font-bold text-lg">{order.order_number}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-base">{orderTypeIcon[order.order_type]}</span>
            <span className="text-foreground text-sm font-medium capitalize">{order.order_type.replace("_", " ")}</span>
            {order.table_number && (
              <span className="bg-elevated text-foreground text-xs px-1.5 py-0.5 rounded">{order.table_number}</span>
            )}
          </div>
          {order.customer_name && (
            <div className="text-muted-foreground text-xs mt-1">
              {order.customer_name}
              {order.customer_phone && ` • ${order.customer_phone}`}
            </div>
          )}
          {order.scheduled_for && (
            <div className="text-purple-700 text-xs font-bold mt-1">
              ⏰ Scheduled {new Date(order.scheduled_for).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
            </div>
          )}
        </div>
        <div className="text-right">
          <div
            className={`text-xs font-bold px-2 py-1 rounded-full ${
              order.just_cancelled
                ? "bg-red-700 text-white"
                : order.status === "ready"
                ? "bg-green-600/30 text-green-600"
                : order.is_modification
                ? "bg-orange-600/30 text-orange-700"
                : "bg-yellow-600/30 text-yellow-600"
            }`}
          >
            {order.just_cancelled ? "❌ CANCELLED" : order.status === "ready" ? "READY" : order.is_modification ? "🔁 ADDED ITEMS" : "NEW"}
          </div>
          {!order.just_cancelled && (
            <div className={`text-xs font-bold mt-1 ${getTimerColor(order)}`}>
              {/* tick included to trigger re-render every 60s */}
              {tick >= 0 && getAgeMinutes(order.created_at)}m ago
            </div>
          )}
        </div>
      </div>

      {!order.just_cancelled && orderHasChanges(order) && (
        <div className="mb-2 -mt-1 text-[10px] font-black text-red-700 bg-red-100 border border-red-300 rounded px-2 py-1 inline-block">
          ⚠ ITEMS CHANGED SINCE SENT
        </div>
      )}

      <div className="border-t border-border pt-3 space-y-1.5">
        {order.items.map((item) => (
          <ItemRow key={item.id} item={item} orderId={order.id} canBump={canBumpItems} onBumpItem={onBumpItem} />
        ))}
      </div>
      {canBumpItems && order.items.some((i) => i.status !== "cancelled") && (
        <div className="mt-1.5 text-[10px] text-muted-foreground">Tap an item to bump it</div>
      )}

      {order.notes && (
        <div className="mt-2 bg-yellow-100 border border-yellow-300 rounded-lg px-2 py-1.5 text-yellow-700 text-xs">
          📝 {order.notes}
        </div>
      )}

      {order.just_cancelled ? (
        <div className="mt-3 bg-red-700 rounded-lg px-3 py-2 text-center">
          <p className="text-white text-xs font-bold">Stop prep — guest cancelled</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <PrintButton
            orderId={order.id}
            kind="kot"
            label="🖨️ Print KOT"
            className="pos-btn no-select w-full py-2 bg-elevated hover:bg-elevated-hover border border-elevated text-foreground font-semibold rounded-lg text-xs transition-colors"
          />
          {order.status === "sent_to_kitchen" && (
            <button
              onClick={() => onMarkReady(order.id)}
              className="pos-btn no-select w-full py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-sm transition-colors"
            >
              ⚡ Bump All
            </button>
          )}
          {order.status === "ready" && (
            <div className="bg-green-100 border border-green-300/50 rounded-lg px-3 py-2 text-center">
              <p className="text-green-700 text-xs font-semibold">✓ Food is Ready</p>
              <p className="text-muted-foreground text-[10px] mt-0.5">Cashier collects payment at POS</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Standalone card — a takeaway/delivery order, or a dine-in table with only
// one round so far.
function KitchenOrderCard({
  order,
  tick,
  onMarkReady,
  onBumpItem,
}: {
  order: OrderWithItems;
  tick: number;
  onMarkReady: (orderId: number) => void;
  onBumpItem: (orderId: number, itemId: number, status: "ready" | "pending") => void;
}) {
  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${getOrderCardClass(order)}`}>
      <OrderTicketBody order={order} tick={tick} onMarkReady={onMarkReady} onBumpItem={onBumpItem} />
    </div>
  );
}

// A table with more than one round sent to the kitchen today — all rounds
// stack inside one card instead of scattering across the board by timestamp,
// so staff read a table's whole order together. Bordered by the oldest
// round's urgency (both sections are already status-uniform — see
// activeOrders/readyOrders — so every round in a group shares a status).
function TableGroupCard({
  orders,
  tick,
  onMarkReady,
  onBumpItem,
}: {
  orders: OrderWithItems[];
  tick: number;
  onMarkReady: (orderId: number) => void;
  onBumpItem: (orderId: number, itemId: number, status: "ready" | "pending") => void;
}) {
  const oldest = orders[0];
  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${getOrderCardClass(oldest)}`}>
      <div className="text-foreground font-bold text-lg mb-1">
        {oldest.table_number ? `Table ${oldest.table_number}` : "Table"}
        <span className="text-muted-foreground text-xs font-medium ml-2">{orders.length} rounds</span>
      </div>
      <div className="space-y-3 divide-y divide-border">
        {orders.map((order, i) => (
          <div key={order.id} className={i > 0 ? "pt-3" : ""}>
            <div className="text-[10px] font-black tracking-wide text-muted-foreground uppercase mb-1.5">Round {i + 1}</div>
            <OrderTicketBody order={order} tick={tick} onMarkReady={onMarkReady} onBumpItem={onBumpItem} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Ready orders are done — kitchen's part is finished, they're just waiting on
// the cashier — so they get a compact chip instead of a full card, leaving
// the Active grid (still-cooking tables) the room it needs to avoid paging.
function ReadyChip({ group, onRecall }: { group: OrderWithItems[]; onRecall: (orderIds: number[]) => void }) {
  const rep = group[0];
  const label = rep.table_number
    ? `${rep.table_number}${group.length > 1 ? ` · ${group.length} ready` : ""}`
    : rep.order_number;
  return (
    <div className="flex items-center gap-1.5 bg-green-100 border border-green-300 rounded-full px-3 py-1.5 flex-shrink-0">
      <span className="text-green-600 text-sm">✓</span>
      <span className="text-foreground text-sm font-bold">{label}</span>
      {!rep.table_number && (
        <span className="text-muted-foreground text-xs capitalize">{rep.order_type.replace("_", " ")}</span>
      )}
      <button
        onClick={() => onRecall(group.map((o) => o.id))}
        title="Bumped by mistake? Send back to Active."
        className="pos-btn no-select ml-1 text-green-700 hover:text-green-900 text-xs font-bold border border-green-300 rounded-full px-2 py-0.5 bg-white/50 hover:bg-white transition-colors"
      >
        ↺ Recall
      </button>
    </div>
  );
}

export default function KitchenBoard() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [tick, setTick] = useState(0);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/kitchen", { cache: "no-store" });
      const data = await res.json();
      const newOrders: OrderWithItems[] = data.orders || [];
      setOrders(newOrders);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to fetch kitchen orders", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Tick every 60s to force re-render of time displays without refetching
  useEffect(() => {
    const tickInterval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(tickInterval);
  }, []);

  const handleStatusUpdate = async (orderId: number, status: string) => {
    try {
      await fetch("/api/kitchen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status }),
      });
      fetchOrders();
    } catch (err) {
      console.error("Failed to update order status", err);
    }
  };

  const handleBumpItem = async (orderId: number, itemId: number, status: "ready" | "pending") => {
    try {
      await fetch(`/api/orders/${orderId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, status }),
      });
      fetchOrders();
    } catch (err) {
      console.error("Failed to bump item", err);
    }
  };

  // A ready group may be several rounds (TableGroupCard) bumped together —
  // recall reopens all of them so the table's whole ticket comes back as one
  // unit, not just the round that happened to be first in the group.
  const handleRecall = async (orderIds: number[]) => {
    try {
      await Promise.all(orderIds.map((id) => handleStatusUpdate(id, "sent_to_kitchen")));
    } catch (err) {
      console.error("Failed to recall order", err);
    }
  };

  // Split so the board can show unstarted work separately from work that's
  // done but not yet paid for (see the Orders section below).
  // Memoized on `orders` (not recomputed on every tick/page-rotation render)
  // — groupByTable/filter build new arrays each call, and an unstable
  // reference here fed straight into usePaginatedGrid's effect deps, which
  // retriggered its setState every render: an infinite update loop (React
  // error #185) that took the whole page down in production.
  const activeOrders = useMemo(() => orders.filter((o) => o.status !== "ready"), [orders]);
  const readyOrders = useMemo(() => orders.filter((o) => o.status === "ready"), [orders]);
  const activeGroups = useMemo(() => groupByTable(activeOrders), [activeOrders]);
  const readyGroups = useMemo(() => groupByTable(readyOrders), [readyOrders]);
  const { containerRef: activeGridRef, measureRef: activeMeasureRef, page: activePage, pageCount: activePageCount, visible: visibleActiveGroups } = usePaginatedGrid(activeGroups);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground text-xl animate-pulse">
          Loading kitchen orders...
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="h-full flex flex-col">
      {/* Header — title on top, Back button underneath it */}
      <div className="bg-surface border-b border-border px-3 sm:px-6 py-2.5 sm:py-3 flex-shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl">🍳</span>
          <h1 style={{ fontFamily: "var(--font-space-grotesk)" }} className="text-foreground font-semibold text-base sm:text-xl leading-tight tracking-[-0.02em]">Kitchen Display</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500 inline-block" />
            <span className="text-yellow-600 text-xs sm:text-sm font-medium">
              New: {orders.filter((o) => o.status === "sent_to_kitchen").length}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500 inline-block" />
            <span className="text-green-600 text-xs sm:text-sm font-medium">
              Ready: {orders.filter((o) => o.status === "ready").length}
            </span>
          </div>
          {orders.some((o) => o.just_cancelled) && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-600 inline-block animate-pulse" />
              <span className="text-red-600 text-xs sm:text-sm font-bold">
                Cancelled: {orders.filter((o) => o.just_cancelled).length}
              </span>
            </div>
          )}
          <div className="text-muted-foreground text-[10px] sm:text-xs hidden lg:block">
            Refreshes every 10s • Last:{" "}
            {lastRefresh.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
          <button
            onClick={fetchOrders}
            className="px-2.5 sm:px-3 py-1.5 bg-surface-hover hover:bg-elevated text-foreground text-xs font-semibold rounded-lg border border-border transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>
      <Link href="/pos"
        className="mt-2 inline-block px-2.5 sm:px-3 py-1.5 bg-surface-hover hover:bg-elevated text-foreground text-xs sm:text-sm font-semibold rounded-lg border border-border transition-colors">
        ← Back
      </Link>
      </div>

      <TableRequestsBanner />

      {/* Orders — Ready is a compact strip (kitchen's work there is already
          done, just waiting on the cashier), so Active gets the room it
          needs to fit without scrolling. Active pages/auto-rotates instead
          of scrolling once there's more than fits on screen. */}
      <div className="flex-1 overflow-hidden p-2.5 sm:p-4 flex flex-col gap-3 sm:gap-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <span className="text-6xl">✅</span>
            <p className="text-xl font-semibold">All caught up!</p>
            <p className="text-sm">No pending kitchen orders</p>
          </div>
        ) : (
          <>
            {readyGroups.length > 0 && (
              <div className="flex-shrink-0">
                <h2 className="text-foreground font-bold text-sm mb-2 flex items-center gap-1.5">
                  ✅ Ready for Pickup <span className="text-muted-foreground font-normal">({readyOrders.length})</span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  {readyGroups.map((group) => (
                    <ReadyChip key={group[0].id} group={group} onRecall={handleRecall} />
                  ))}
                </div>
              </div>
            )}

            {activeGroups.length > 0 && (
              <section className="flex-1 min-h-0 flex flex-col">
                <h2 className="text-foreground font-bold text-sm mb-2.5 flex-shrink-0 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    🔥 Active <span className="text-muted-foreground font-normal">({activeOrders.length})</span>
                  </span>
                  {activePageCount > 1 && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
                      Page {activePage + 1} of {activePageCount}
                      <span className="flex gap-1">
                        {Array.from({ length: activePageCount }).map((_, i) => (
                          <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === activePage ? "bg-foreground" : "bg-elevated"}`} />
                        ))}
                      </span>
                    </span>
                  )}
                </h2>
                <div ref={activeGridRef} className="flex-1 min-h-0 overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {visibleActiveGroups.map((group) =>
                      group.length === 1 ? (
                        <KitchenOrderCard key={group[0].id} order={group[0]} tick={tick} onMarkReady={(id) => handleStatusUpdate(id, "ready")} onBumpItem={handleBumpItem} />
                      ) : (
                        <TableGroupCard key={group[0].id} orders={group} tick={tick} onMarkReady={(id) => handleStatusUpdate(id, "ready")} onBumpItem={handleBumpItem} />
                      )
                    )}
                  </div>
                </div>
                {/* Hidden measuring pass — identical grid/cards, zero visual
                    footprint (collapsed wrapper still lays out children). */}
                <div style={{ visibility: "hidden", height: 0, overflow: "hidden", position: "relative" }} aria-hidden="true">
                  <div ref={activeMeasureRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {activeGroups.map((group) =>
                      group.length === 1 ? (
                        <KitchenOrderCard key={group[0].id} order={group[0]} tick={tick} onMarkReady={(id) => handleStatusUpdate(id, "ready")} onBumpItem={handleBumpItem} />
                      ) : (
                        <TableGroupCard key={group[0].id} orders={group} tick={tick} onMarkReady={(id) => handleStatusUpdate(id, "ready")} onBumpItem={handleBumpItem} />
                      )
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>

    </div>
    </>
  );
}
