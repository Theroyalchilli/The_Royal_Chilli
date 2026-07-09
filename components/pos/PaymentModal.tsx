"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import type { CartItem } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  orderId: number | null;
  orderNumber: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  onPaymentComplete: () => void;
}

type PayStep = "method" | "cash_amount" | "card_confirm" | "receipt";

export default function PaymentModal({
  open,
  onClose,
  orderId,
  orderNumber,
  items,
  subtotal,
  discount,
  tax,
  total,
  onPaymentComplete,
}: Props) {
  const [step, setStep] = useState<PayStep>("method");
  const [method, setMethod] = useState<"cash" | "card" | null>(null);
  const [cashInput, setCashInput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cashAmount = parseFloat(cashInput) || 0;
  const change = Math.max(0, cashAmount - total);

  const handleClose = () => {
    setStep("method");
    setMethod(null);
    setCashInput("");
    setError("");
    onClose();
  };

  const handleCashDigit = (d: string) => {
    if (d === "." && cashInput.includes(".")) return;
    if (cashInput === "0" && d !== ".") {
      setCashInput(d);
      return;
    }
    setCashInput((prev) => prev + d);
  };

  const handleCashBackspace = () => {
    setCashInput((prev) => prev.slice(0, -1));
  };

  const handleProcessPayment = async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        method,
        amount: method === "cash" ? cashAmount : total,
        change_given: method === "cash" ? change : 0,
      };

      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Payment failed");
        return;
      }

      setStep("receipt");
      onPaymentComplete();
    } catch {
      setError("Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [
    Math.ceil(total),
    Math.ceil(total / 5) * 5,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 20) * 20,
  ].filter((v, i, arr) => arr.indexOf(v) === i && v >= total).slice(0, 4);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            {step === "receipt" ? "Payment Complete" : "Payment"}
            {orderNumber && (
              <span className="text-orange-400 text-sm font-normal ml-2">
                #{orderNumber}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Method Selection */}
        {step === "method" && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Order Total</div>
              <div className="text-orange-400 text-4xl font-bold">
                {formatCurrency(total)}
              </div>
              {discount > 0 && (
                <div className="text-yellow-400 text-xs mt-1">
                  Includes discount of {formatCurrency(discount)}
                </div>
              )}
            </div>

            <div className="text-gray-400 text-sm font-medium text-center">
              Select Payment Method
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setMethod("cash");
                  setStep("cash_amount");
                }}
                className="pos-btn no-select flex flex-col items-center gap-2 p-6 bg-green-900/40 hover:bg-green-800/60 border-2 border-green-600 rounded-xl text-green-300 transition-all"
              >
                <span className="text-4xl">💵</span>
                <span className="font-bold text-lg">CASH</span>
              </button>

              <button
                onClick={() => {
                  setMethod("card");
                  setStep("card_confirm");
                }}
                className="pos-btn no-select flex flex-col items-center gap-2 p-6 bg-blue-900/40 hover:bg-blue-800/60 border-2 border-blue-600 rounded-xl text-blue-300 transition-all"
              >
                <span className="text-4xl">💳</span>
                <span className="font-bold text-lg">CARD</span>
              </button>
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center">{error}</div>
            )}
          </div>
        )}

        {/* Cash Amount Entry */}
        {step === "cash_amount" && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl p-4 flex justify-between items-center">
              <div>
                <div className="text-gray-400 text-sm">To Pay</div>
                <div className="text-orange-400 text-2xl font-bold">
                  {formatCurrency(total)}
                </div>
              </div>
              {cashAmount > 0 && (
                <div className="text-right">
                  <div className="text-gray-400 text-sm">Change</div>
                  <div
                    className={`text-2xl font-bold ${change >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {formatCurrency(change)}
                  </div>
                </div>
              )}
            </div>

            {/* Cash amount display */}
            <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 text-center">
              <div className="text-gray-400 text-sm mb-1">Cash Received</div>
              <div className="text-white text-3xl font-mono font-bold">
                £{cashInput || "0.00"}
              </div>
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setCashInput(amt.toFixed(2))}
                  className="pos-btn no-select py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-white text-sm font-semibold"
                >
                  £{amt}
                </button>
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map(
                (d) => (
                  <button
                    key={d}
                    onClick={() => handleCashDigit(d)}
                    className="pos-btn no-select h-12 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-white font-bold text-lg"
                  >
                    {d}
                  </button>
                )
              )}
              <button
                onClick={handleCashBackspace}
                className="pos-btn no-select h-12 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-gray-400 font-bold text-lg"
              >
                ⌫
              </button>
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setStep("method"); setCashInput(""); }}
                className="pos-btn no-select h-12 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-xl text-gray-300 font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleProcessPayment}
                disabled={cashAmount < total || loading}
                className="pos-btn no-select h-12 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl transition-all"
              >
                {loading ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        )}

        {/* Card Confirm */}
        {step === "card_confirm" && (
          <div className="space-y-4">
            <div className="bg-blue-900/30 border border-blue-600 rounded-xl p-6 text-center">
              <div className="text-5xl mb-3">💳</div>
              <div className="text-gray-300 text-sm mb-1">Present card terminal for</div>
              <div className="text-white text-4xl font-bold">
                {formatCurrency(total)}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-300">
                <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-yellow-400">
                  <span>Discount</span><span>−{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-400">
                <span>VAT (20%)</span><span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-white font-bold border-t border-gray-600 pt-2">
                <span>Total</span><span className="text-orange-400">{formatCurrency(total)}</span>
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStep("method")}
                className="pos-btn no-select h-12 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-xl text-gray-300 font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleProcessPayment}
                disabled={loading}
                className="pos-btn no-select h-12 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
              >
                {loading ? "Processing..." : "Card Paid ✓"}
              </button>
            </div>
          </div>
        )}

        {/* Receipt */}
        {step === "receipt" && (
          <div className="space-y-4">
            <div className="bg-green-900/30 border border-green-600 rounded-xl p-6 text-center">
              <div className="text-5xl mb-2">✅</div>
              <div className="text-green-400 text-xl font-bold">Payment Successful!</div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 font-mono text-sm">
              <div className="text-center text-white font-bold mb-2">
                THE ROYAL CHILLI
              </div>
              <div className="text-center text-gray-400 text-xs mb-3">
                43 Kingsley Road, Hounslow TW3 1PA
              </div>
              <div className="border-t border-dashed border-gray-600 pt-2 space-y-1">
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between text-gray-300 text-xs">
                    <span>{item.quantity}x {item.item_name}</span>
                    <span>{formatCurrency(item.item_price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-gray-600 mt-2 pt-2 space-y-1">
                <div className="flex justify-between text-gray-400 text-xs">
                  <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-yellow-400 text-xs">
                    <span>Discount</span><span>−{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400 text-xs">
                  <span>VAT (20%)</span><span>{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between text-white font-bold">
                  <span>TOTAL</span><span>{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-gray-300 text-xs">
                  <span>Paid by</span>
                  <span className="capitalize">{method}</span>
                </div>
                {method === "cash" && (
                  <>
                    <div className="flex justify-between text-gray-300 text-xs">
                      <span>Cash given</span><span>{formatCurrency(cashAmount)}</span>
                    </div>
                    <div className="flex justify-between text-green-400 text-xs font-semibold">
                      <span>Change</span><span>{formatCurrency(change)}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="text-center text-gray-500 text-xs mt-3">
                Thank you for visiting!<br />
                {new Date().toLocaleString("en-GB")}
              </div>
            </div>

            <button
              onClick={handleClose}
              className="pos-btn no-select w-full h-12 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl"
            >
              New Order
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
