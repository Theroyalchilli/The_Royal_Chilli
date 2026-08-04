"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import type { CartItem } from "@/lib/types";

interface Props {
  items: CartItem[];
  onUpdateQty: (idx: number, qty: number) => void;
  onRemove: (idx: number) => void;
  onVoid: (idx: number, newQty: number) => void;
}

function VoidPanel({ item, idx, onVoid, onClose }: {
  item: CartItem;
  idx: number;
  onVoid: (idx: number, qty: number) => void;
  onClose: () => void;
}) {
  // qty=1 items default to full void (keep=0); qty>1 starts at original so cashier must reduce
  const [qty, setQty] = useState(item.quantity === 1 ? 0 : item.quantity);

  const confirm = () => {
    onVoid(idx, qty);
    onClose();
  };

  return (
    <div className="mt-1.5 bg-red-50 border border-red-200 rounded-xl p-3 space-y-2.5">
      <p className="text-red-700 text-xs font-bold">Void: {item.item_name}</p>

      {item.quantity > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs">Qty to keep:</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setQty(q => Math.max(0, q - 1))}
              className="w-7 h-7 rounded-lg bg-elevated hover:bg-red-100 hover:text-red-700 text-foreground flex items-center justify-center font-bold no-select">
              −
            </button>
            <span className="text-foreground font-black text-sm w-5 text-center">{qty}</span>
            <button onClick={() => setQty(q => Math.min(item.quantity, q + 1))}
              className="w-7 h-7 rounded-lg bg-elevated hover:bg-elevated-hover text-foreground flex items-center justify-center font-bold no-select">
              +
            </button>
          </div>
          <span className="text-muted-foreground text-xs">of {item.quantity}</span>
        </div>
      )}

      {qty === 0
        ? <p className="text-red-600 text-xs">Full void — item removed from bill</p>
        : qty < item.quantity
        ? <p className="text-amber-600 text-xs">Reducing from {item.quantity} → {qty}</p>
        : <p className="text-muted-foreground text-xs">Adjust quantity above or confirm void</p>
      }

      <div className="flex gap-2">
        <button onClick={onClose}
          className="flex-1 py-1.5 rounded-lg bg-elevated text-foreground text-xs font-semibold hover:bg-elevated-hover no-select">
          Cancel
        </button>
        <button onClick={confirm}
          disabled={qty === item.quantity}
          className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-elevated disabled:text-muted-foreground text-white text-xs font-bold no-select">
          {qty === 0 ? "Void Item" : "Reduce Qty"}
        </button>
      </div>
    </div>
  );
}

export default function OrderTicket({ items, onUpdateQty, onRemove, onVoid }: Props) {
  const [voidOpenIdx, setVoidOpenIdx] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <span className="text-5xl">🛒</span>
        <p className="text-sm font-medium">Order is empty</p>
        <p className="text-xs">Tap items from the menu to add them</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-1 pr-0.5">
      {items.map((item, idx) => (
        <div key={idx}>
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors ${
            item.voided
              ? "bg-red-50 opacity-70"
              : item.sent
              ? "bg-surface-hover"
              : "bg-surface hover:bg-surface-hover"
          }`}>

            {/* Veg dot + name */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={item.is_veg ? "veg-dot flex-shrink-0" : "non-veg-dot flex-shrink-0"} />
                <span className={`text-sm font-semibold truncate ${item.voided ? "line-through text-muted-foreground" : item.sent ? "text-muted-foreground" : "text-foreground"}`}>
                  {item.item_name}
                </span>
                {item.voided && (
                  <span className="text-[9px] font-black text-red-700 bg-red-100 px-1.5 py-0.5 rounded flex-shrink-0">VOIDED</span>
                )}
                {item.sent && !item.voided && (
                  <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded flex-shrink-0">IN KITCHEN</span>
                )}
              </div>
              {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                <div className="text-muted-foreground text-[11px] truncate">
                  {item.selected_modifiers.map((m) => m.name).join(", ")}
                </div>
              )}
              <span className="text-muted-foreground text-xs">{formatCurrency(item.item_price)} ea</span>
            </div>

            {/* Qty */}
            {item.voided ? (
              <span className="text-muted-foreground line-through text-sm w-5 text-center flex-shrink-0">{item.quantity}</span>
            ) : item.sent ? (
              <span className="text-muted-foreground font-black text-sm w-5 text-center flex-shrink-0">{item.quantity}</span>
            ) : (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => onUpdateQty(idx, item.quantity - 1)}
                  className="w-7 h-7 rounded-lg bg-elevated hover:bg-red-100 hover:text-red-700 text-foreground flex items-center justify-center font-bold no-select pos-btn transition-colors">
                  −
                </button>
                <span className="text-foreground font-black text-sm w-5 text-center">{item.quantity}</span>
                <button onClick={() => onUpdateQty(idx, item.quantity + 1)}
                  className="w-7 h-7 rounded-lg bg-elevated hover:bg-emerald-100 hover:text-emerald-700 text-foreground flex items-center justify-center font-bold no-select pos-btn transition-colors">
                  +
                </button>
              </div>
            )}

            {/* Line total / action */}
            <div className="text-right min-w-[52px] flex-shrink-0">
              <div className={`text-sm font-bold ${item.voided ? "line-through text-muted-foreground" : item.sent ? "text-muted-foreground" : "text-foreground"}`}>
                {formatCurrency(item.item_price * item.quantity)}
              </div>
              {!item.voided && !item.sent && (
                <button onClick={() => onRemove(idx)} className="text-muted-foreground hover:text-red-600 text-[10px] no-select transition-colors">
                  remove
                </button>
              )}
              {item.sent && !item.voided && (
                <button
                  onClick={() => setVoidOpenIdx(voidOpenIdx === idx ? null : idx)}
                  className="text-red-600 hover:text-red-700 text-[10px] font-semibold no-select transition-colors">
                  void
                </button>
              )}
            </div>

          </div>

          {/* Void panel */}
          {voidOpenIdx === idx && !item.voided && (
            <VoidPanel
              item={item}
              idx={idx}
              onVoid={onVoid}
              onClose={() => setVoidOpenIdx(null)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
