"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import type { MenuCategory, MenuItem } from "@/lib/menu";
import { makeLineId, type SelectedOption } from "@/lib/cart";
import ModifierPickerModal from "./ModifierPickerModal";

type OrderItemModifier = { option_name: string; price_delta: number };
type OrderItem = { id: number; item_name: string; item_price: number; quantity: number; status: string; modifiers?: OrderItemModifier[] };
type OrderSummary = { id: number; order_number: string; status: string; total: number } | null;
type PendingLine = { lineId: string; menu_item_id: number; name: string; unitPrice: number; quantity: number; selectedOptions: SelectedOption[] };

const statusLabel: Record<string, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
};

export default function DineInOrder({
  tableNumber,
  categories,
}: {
  tableNumber: string;
  categories: MenuCategory[];
}) {
  const [pending, setPending] = useState<PendingLine[]>([]);
  const [pickerFor, setPickerFor] = useState<MenuItem | null>(null);
  const [order, setOrder] = useState<OrderSummary>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [sending, setSending] = useState(false);
  const [requestMsg, setRequestMsg] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/tables/${tableNumber}`);
      const data = await res.json();
      if (res.ok) {
        setOrder(data.order);
        setItems(data.items || []);
      }
    } catch {
      // silent — next poll will retry
    }
  }, [tableNumber]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  function addLine(item: MenuItem, selectedOptionIds: number[], unitPrice: number) {
    const lineId = makeLineId(item.id, selectedOptionIds);
    setPending((prev) => {
      const existing = prev.find((l) => l.lineId === lineId);
      if (existing) return prev.map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + 1 } : l));
      return [
        ...prev,
        {
          lineId, menu_item_id: item.id, name: item.name, unitPrice, quantity: 1,
          selectedOptions: item.modifierGroups.flatMap((g) => g.options).filter((o) => selectedOptionIds.includes(o.id)),
        },
      ];
    });
  }

  function bumpLine(lineId: string, delta: number) {
    setPending((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0));
  }

  function handleAddClick(item: MenuItem) {
    if (item.modifierGroups.length > 0) setPickerFor(item);
    else addLine(item, [], item.price);
  }

  const linesForItem = (id: number) => pending.filter((l) => l.menu_item_id === id);
  const pendingCount = pending.reduce((s, l) => s + l.quantity, 0);
  const pendingTotal = pending.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  async function sendToKitchen() {
    setError("");
    if (pending.length === 0) return;
    setSending(true);
    try {
      const res = await fetch(`/api/public/tables/${tableNumber}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: pending.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity, selected_options: l.selectedOptions.map((o) => o.id) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send order");
      setOrder(data.order);
      setItems(data.items || []);
      setPending([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  async function sendRequest(type: "waiter" | "bill") {
    setRequestMsg("");
    try {
      await fetch(`/api/public/tables/${tableNumber}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      setRequestMsg(type === "waiter" ? "A waiter has been notified — they'll be right over." : "Bill requested — a member of staff will bring it shortly.");
    } catch {
      setRequestMsg("Couldn't send that request, please ask a member of staff directly.");
    }
  }

  return (
    <div className="pb-32">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Table {tableNumber}</p>
          <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl">
            Welcome to <span className="italic text-primary">The Royal Chilli</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Browse the menu, add items, and send your order straight to the kitchen.</p>
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <button onClick={() => sendRequest("waiter")} className="border border-border px-4 py-2 text-xs uppercase tracking-[0.1em] hover:border-primary hover:text-primary">
            🙋 Call Waiter
          </button>
          <button onClick={() => sendRequest("bill")} className="border border-border px-4 py-2 text-xs uppercase tracking-[0.1em] hover:border-primary hover:text-primary">
            🧾 Request Bill
          </button>
        </div>
        {requestMsg && <p className="mt-3 text-center text-sm text-primary">{requestMsg}</p>}

        {items.length > 0 && (
          <div className="mt-8 border border-border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Your Order {order && <span className="text-muted-foreground">· {order.order_number}</span>}</h2>
              {order && <span className="font-semibold text-primary">{formatCurrency(order.total)}</span>}
            </div>
            <div className="mt-3 space-y-1.5">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-sm">
                  <span>
                    {it.quantity} × {it.item_name}
                    {it.modifiers && it.modifiers.length > 0 && (
                      <span className="text-muted-foreground"> ({it.modifiers.map((m) => m.option_name).join(", ")})</span>
                    )}
                  </span>
                  <span className={`text-xs ${it.status === "ready" ? "text-green-500" : it.status === "cancelled" ? "text-red-500" : "text-muted-foreground"}`}>
                    {statusLabel[it.status] || it.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 space-y-14">
          {categories.map((category) => (
            <section key={category.id}>
              <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-primary">{category.name}</h2>
              <div className="mt-4 divide-y divide-border">
                {category.items.map((item) => {
                  const lines = linesForItem(item.id);
                  const hasModifiers = item.modifierGroups.length > 0;
                  return (
                    <div key={item.id} className="py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-block h-2.5 w-2.5 rounded-full border ${item.is_veg ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500"}`} />
                            <h3 className="font-medium">{item.name}</h3>
                          </div>
                          {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
                          {item.allergens.length > 0 && (
                            <p className="mt-0.5 text-xs text-muted-foreground/80">Contains: <span className="capitalize">{item.allergens.join(", ")}</span></p>
                          )}
                          <p className="mt-1 font-semibold text-primary">{formatCurrency(item.price)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {!hasModifiers && lines[0] && (
                            <>
                              <button onClick={() => bumpLine(lines[0].lineId, -1)} className="h-8 w-8 rounded-full border border-border text-lg leading-none hover:border-primary">−</button>
                              <span className="w-4 text-center">{lines[0].quantity}</span>
                            </>
                          )}
                          <button onClick={() => handleAddClick(item)} className="h-8 w-8 rounded-full border border-border text-lg leading-none hover:border-primary">+</button>
                        </div>
                      </div>
                      {hasModifiers && lines.length > 0 && (
                        <div className="mt-2 space-y-1 pl-1">
                          {lines.map((l) => (
                            <div key={l.lineId} className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{l.selectedOptions.map((o) => o.name).join(", ") || "Standard"} · {formatCurrency(l.unitPrice)}</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => bumpLine(l.lineId, -1)} className="h-9 w-9 rounded-full border border-border text-base leading-none">−</button>
                                <span className="w-3 text-center">{l.quantity}</span>
                                <button onClick={() => bumpLine(l.lineId, 1)} className="h-9 w-9 rounded-full border border-border text-base leading-none">+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
            <span className="text-sm text-muted-foreground">
              {pendingCount} item{pendingCount > 1 ? "s" : ""} · {formatCurrency(pendingTotal)}
            </span>
            <button
              onClick={sendToKitchen}
              disabled={sending}
              className="bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.15em] text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send to Kitchen"}
            </button>
          </div>
          {error && <p className="pb-2 text-center text-sm text-red-500">{error}</p>}
        </div>
      )}

      {pickerFor && (
        <ModifierPickerModal
          item={pickerFor}
          onClose={() => setPickerFor(null)}
          onConfirm={(ids, unitPrice) => {
            addLine(pickerFor, ids, unitPrice);
            setPickerFor(null);
          }}
        />
      )}
    </div>
  );
}
