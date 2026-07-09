"use client";

import { formatCurrency } from "@/lib/utils";
import type { CartItem } from "@/lib/types";

interface Props {
  items: CartItem[];
  discount: number;
  onUpdateQty: (idx: number, qty: number) => void;
  onRemove: (idx: number) => void;
  onSetDiscount: (discount: number, reason: string) => void;
}

export default function OrderTicket({
  items,
  discount,
  onUpdateQty,
  onRemove,
  onSetDiscount,
}: Props) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.item_price * item.quantity,
    0
  );
  const discountAmt = discount;
  const taxable = subtotal - discountAmt;
  const tax = Math.round(taxable * 0.2 * 100) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;

  const handleDiscountToggle = () => {
    if (discount > 0) {
      onSetDiscount(0, "");
    } else {
      const d = Math.round(subtotal * 0.1 * 100) / 100;
      onSetDiscount(d, "Happy Hour 10%");
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-3">
        <span className="text-5xl">🛒</span>
        <p className="text-sm font-medium">Order is empty</p>
        <p className="text-xs text-center">Tap items from the menu to add them</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Items list */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 bg-gray-800/60 rounded-lg p-2"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className={item.is_veg ? "veg-dot" : "non-veg-dot"} />
                <span className="text-white text-sm font-medium truncate">
                  {item.item_name}
                </span>
              </div>
              <div className="text-orange-400 text-xs font-semibold">
                {formatCurrency(item.item_price)} ea
              </div>
            </div>

            {/* Qty controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdateQty(idx, item.quantity - 1)}
                className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center text-sm font-bold no-select pos-btn"
              >
                −
              </button>
              <span className="text-white font-bold text-sm w-5 text-center">
                {item.quantity}
              </span>
              <button
                onClick={() => onUpdateQty(idx, item.quantity + 1)}
                className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center text-sm font-bold no-select pos-btn"
              >
                +
              </button>
            </div>

            {/* Line total */}
            <div className="text-right min-w-[52px]">
              <div className="text-white text-sm font-bold">
                {formatCurrency(item.item_price * item.quantity)}
              </div>
              <button
                onClick={() => onRemove(idx)}
                className="text-red-500 hover:text-red-400 text-xs no-select"
              >
                remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t border-gray-700 pt-3 mt-2 space-y-1.5">
        <div className="flex justify-between text-sm text-gray-300">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <button
            onClick={handleDiscountToggle}
            className={`text-xs px-2 py-1 rounded-lg no-select transition-colors ${
              discount > 0
                ? "bg-yellow-600/30 text-yellow-400 border border-yellow-600"
                : "bg-gray-700 text-gray-400 hover:text-yellow-400"
            }`}
          >
            {discount > 0 ? "✓ Discount Applied" : "Apply Discount"}
          </button>
          {discount > 0 && (
            <span className="text-yellow-400 font-semibold">
              −{formatCurrency(discountAmt)}
            </span>
          )}
        </div>

        <div className="flex justify-between text-sm text-gray-400">
          <span>VAT (20%)</span>
          <span>{formatCurrency(tax)}</span>
        </div>

        <div className="flex justify-between text-lg font-bold text-white border-t border-gray-600 pt-2">
          <span>TOTAL</span>
          <span className="text-orange-400">{formatCurrency(total)}</span>
        </div>

        <div className="text-xs text-gray-500 text-center">
          {items.reduce((s, i) => s + i.quantity, 0)} items • VAT incl.
        </div>
      </div>
    </div>
  );
}
