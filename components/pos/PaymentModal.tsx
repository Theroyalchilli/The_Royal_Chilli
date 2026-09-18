"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { CartItem } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  orderId: number | null;
  orderNumber: string;
  customerId?: number | null;
  extraOrderIds: number[];
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  onPaymentComplete: () => void;
}

type PayStep = "method" | "cash_amount" | "card_confirm" | "partial" | "receipt" | "pay_later_confirm" | "pay_later_done";

export default function PaymentModal({
  open,
  onClose,
  orderId,
  orderNumber,
  customerId,
  extraOrderIds,
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
  const [payLaterNote, setPayLaterNote] = useState("");
  const { toast } = useToast();

  // Discount state — overrides props once applied
  const [discountInput, setDiscountInput] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "pct">("fixed");
  const [discountReasonInput, setDiscountReasonInput] = useState("");
  const [localDiscount, setLocalDiscount] = useState(discount);
  const [localTax, setLocalTax] = useState(tax);
  const [localTotal, setLocalTotal] = useState(total);
  const [discountApplying, setDiscountApplying] = useState(false);

  // Loyalty balance/earn preview — shown whenever this order is linked to a
  // customer. Both numbers are real (same calc the actual award uses), not
  // guesses, so they never disagree with what posts once payment completes.
  const [loyaltyPreview, setLoyaltyPreview] = useState<{ customerName: string; currentBalance: number; willEarn: number; tierName: string | null } | null>(null);

  // Loyalty reward redemption — staff enter a code issued earlier from the
  // Customers & Loyalty screen; a successful redeem may adjust the discount.
  const [rewardCodeInput, setRewardCodeInput] = useState("");
  const [rewardApplying, setRewardApplying] = useState(false);
  const [rewardError, setRewardError] = useState("");
  const [appliedReward, setAppliedReward] = useState<string | null>(null);

  // Service charge
  const [serviceChargeInput, setServiceChargeInput] = useState("");
  const [localServiceCharge, setLocalServiceCharge] = useState(0);
  const [serviceChargeApplying, setServiceChargeApplying] = useState(false);

  // Split bill + tip + running balance across multiple payments on the same order
  const [remainingBalance, setRemainingBalance] = useState(total);
  const [splitCount, setSplitCount] = useState(1);
  const [tipInput, setTipInput] = useState("");
  const [lastPaymentAmount, setLastPaymentAmount] = useState(0);
  // Lets the cashier charge an arbitrary amount for this round instead of an
  // even split — e.g. "customer has £15 cash, put the rest on card". Null
  // means "use the even split"; sits between rounds so each partial payment
  // starts back at the full remaining/split amount.
  const [amountOverride, setAmountOverride] = useState<string | null>(null);

  // Stripe Terminal card reader — falls back to the manual "Card Paid" button
  // below if no reader is configured in Settings.
  const [readerEnabled, setReaderEnabled] = useState(false);
  const [terminalStatus, setTerminalStatus] = useState<"idle" | "processing" | "failed">("idle");
  const [terminalError, setTerminalError] = useState("");
  const [terminalPiId, setTerminalPiId] = useState<string | null>(null);
  const [useManualCard, setUseManualCard] = useState(false);

  useEffect(() => {
    fetch("/api/pos/terminal/config").then((r) => r.json()).then((d) => setReaderEnabled(!!d.enabled)).catch(() => setReaderEnabled(false));
  }, []);

  useEffect(() => {
    if (!open || !customerId) { setLoyaltyPreview(null); return; }
    fetch(`/api/loyalty/estimate?customer_id=${customerId}&amount=${localTotal}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setLoyaltyPreview({ customerName: d.customer_name, currentBalance: d.current_balance, willEarn: d.will_earn, tierName: d.tier_name });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId, localTotal]);

  // Reset everything whenever the modal opens for a (possibly new) order.
  useEffect(() => {
    if (open) {
      setStep("method");
      setMethod(null);
      setCashInput("");
      setError("");
      setDiscountInput("");
      setDiscountType("fixed");
      setDiscountReasonInput("");
      setLocalDiscount(discount);
      setLocalTax(tax);
      setLocalTotal(total);
      setServiceChargeInput("");
      setLocalServiceCharge(0);
      setRemainingBalance(total);
      setSplitCount(1);
      setAmountOverride(null);
      setTipInput("");
      setTerminalStatus("idle");
      setTerminalError("");
      setTerminalPiId(null);
      setUseManualCard(false);
      setPayLaterNote("");
      setRewardCodeInput("");
      setRewardError("");
      setAppliedReward(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  const applyDiscount = async () => {
    if (!orderId || !discountInput) return;
    const raw = parseFloat(discountInput) || 0;
    setDiscountApplying(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discount_type: discountType === "pct" ? "percent" : "amount",
          discount_value: raw,
          discount_reason: discountReasonInput || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to apply discount"); return; }
      if (data.order) {
        setLocalDiscount(data.order.discount ?? 0);
        setLocalTax(data.order.tax ?? localTax);
        setLocalTotal(data.order.total ?? localTotal);
        setRemainingBalance(data.order.total ?? localTotal);
        toast({ variant: "success", title: "Discount applied" });
      }
    } catch { setError("Failed to apply discount"); }
    finally { setDiscountApplying(false); }
  };

  const removeDiscount = async () => {
    if (!orderId) return;
    setDiscountApplying(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount_type: null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to remove discount"); return; }
      if (data.order) {
        setLocalDiscount(0);
        setLocalTax(data.order.tax ?? tax);
        setLocalTotal(data.order.total ?? total);
        setRemainingBalance(data.order.total ?? total);
        setDiscountInput("");
        setDiscountReasonInput("");
      }
    } catch { setError("Failed to remove discount"); }
    finally { setDiscountApplying(false); }
  };

  const applyRewardCode = async () => {
    if (!orderId || !rewardCodeInput.trim()) return;
    setRewardApplying(true);
    setRewardError("");
    try {
      const res = await fetch("/api/loyalty/redemptions/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: rewardCodeInput.trim(), order_id: orderId }),
      });
      const data = await res.json();
      if (!res.ok) { setRewardError(data.message || data.error || "Couldn't redeem this code"); return; }
      setAppliedReward(data.reward_name);
      setRewardCodeInput("");
      if (data.bill) {
        setLocalDiscount(data.bill.discount ?? localDiscount);
        setLocalTax(data.bill.tax ?? localTax);
        setLocalTotal(data.bill.total ?? localTotal);
        setRemainingBalance(data.bill.total ?? localTotal);
      }
      toast({ variant: "success", title: "Reward applied", description: data.reward_name });
    } catch { setRewardError("Couldn't redeem this code"); }
    finally { setRewardApplying(false); }
  };

  const applyServiceCharge = async (pct: number) => {
    if (!orderId) return;
    setServiceChargeApplying(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/service-charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pct }),
      });
      const data = await res.json();
      if (data.order) {
        setLocalServiceCharge(data.order.service_charge_amount ?? 0);
        setLocalTotal(data.order.total ?? localTotal);
        setRemainingBalance(data.order.total ?? localTotal);
      }
    } catch { /* silent */ }
    finally { setServiceChargeApplying(false); }
  };

  // What this specific payment transaction should collect — the full remaining
  // balance, or an equal share of it if the bill is being split N ways, unless
  // the cashier has typed a custom amount for a mixed cash/card tender.
  const splitAmount = Math.round((remainingBalance / Math.max(1, splitCount)) * 100) / 100;
  const amountDue = amountOverride !== null
    ? Math.min(Math.max(0, Math.round((parseFloat(amountOverride) || 0) * 100) / 100), remainingBalance)
    : splitAmount;
  const tipAmount = parseFloat(tipInput) || 0;
  const cashAmount = parseFloat(cashInput) || 0;
  const change = Math.max(0, cashAmount - amountDue - tipAmount);

  const handleClose = () => {
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

  const handleProcessPayment = async (reference?: string) => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    try {
      const amount = method === "cash" ? Math.min(cashAmount - tipAmount, amountDue) : amountDue;
      const body: Record<string, unknown> = {
        method,
        amount,
        tip_amount: tipAmount,
        change_given: method === "cash" ? change : 0,
        reference: reference || undefined,
        extraOrderIds: extraOrderIds.length > 0 ? extraOrderIds : undefined,
      };

      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Payment failed");
        return;
      }

      setLastPaymentAmount(amount);
      setRemainingBalance(data.remaining_balance ?? 0);
      setTipInput("");
      setCashInput("");

      if (data.fully_paid) {
        setStep("receipt");
        onPaymentComplete();
      } else {
        setStep("partial");
        onPaymentComplete();
      }
    } catch {
      setError("Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePayLater = async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}/pay-later`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: payLaterNote || undefined,
          extraOrderIds: extraOrderIds.length > 0 ? extraOrderIds : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to mark pay later");
        return;
      }
      setStep("pay_later_done");
      onPaymentComplete();
    } catch {
      setError("Failed to mark pay later. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Pushes a real charge to the restaurant's registered Stripe Terminal
  // reader for the card leg of the bill (bill amount + tip in one real
  // transaction), then polls until the customer has tapped/inserted their
  // card. Only reached when a reader is actually configured — otherwise the
  // existing manual "Card Paid" button below handles a separate card machine.
  const startTerminalCharge = async () => {
    setTerminalStatus("processing");
    setTerminalError("");
    try {
      const chargeRes = await fetch("/api/pos/terminal/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountDue + tipAmount }),
      });
      const chargeData = await chargeRes.json();
      if (!chargeRes.ok) {
        setTerminalStatus("failed");
        setTerminalError(chargeData.error || "Failed to start card reader payment");
        return;
      }
      const piId = chargeData.payment_intent_id as string;
      setTerminalPiId(piId);

      const deadline = Date.now() + 90_000; // 90s — plenty for a tap, avoids hanging forever if the reader loses connection
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(`/api/pos/terminal/status?payment_intent_id=${piId}`);
        const statusData = await statusRes.json();
        if (statusData.status === "succeeded") {
          await handleProcessPayment(piId);
          return;
        }
        if (statusData.status === "canceled") {
          setTerminalStatus("failed");
          setTerminalError("Payment was cancelled");
          return;
        }
        if (statusData.status === "requires_payment_method" && statusData.declined) {
          setTerminalStatus("failed");
          setTerminalError(statusData.error_message || "Card declined — please try again");
          return;
        }
        // requires_payment_method with no error yet just means "still waiting
        // for the customer to tap/insert" — keep polling, same as
        // requires_confirmation/processing.
      }
      setTerminalStatus("failed");
      setTerminalError("Timed out waiting for the card reader");
    } catch {
      setTerminalStatus("failed");
      setTerminalError("Lost connection to the card reader");
    }
  };

  const cancelTerminalCharge = async () => {
    if (terminalPiId) {
      fetch("/api/pos/terminal/cancel", { method: "POST" }).catch(() => {});
    }
    setTerminalStatus("idle");
    setTerminalPiId(null);
  };

  const quickAmounts = [
    Math.ceil(amountDue + tipAmount),
    Math.ceil((amountDue + tipAmount) / 5) * 5,
    Math.ceil((amountDue + tipAmount) / 10) * 10,
    Math.ceil((amountDue + tipAmount) / 20) * 20,
  ].filter((v, i, arr) => arr.indexOf(v) === i && v >= amountDue + tipAmount).slice(0, 4);

  const tipPresets = [0, 10, 12.5, 15].map((pct) => ({ pct, amount: Math.round(amountDue * (pct / 100) * 100) / 100 }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-surface border-border max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">
            {step === "receipt" ? "Payment Complete" : step === "partial" ? "Partial Payment Recorded" : step === "pay_later_done" ? "Pay Later" : "Payment"}
            {orderNumber && (
              <span className="text-red-600 text-sm font-normal ml-2">
                #{orderNumber}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Method Selection */}
        {step === "method" && (() => {
          // Merge same items (multiple rounds) by name+price, exclude voided
          const merged = items.filter(i => !i.voided).reduce<{ item_name: string; item_price: number; quantity: number; is_veg?: number }[]>((acc, item) => {
            const existing = acc.find(a => a.item_name === item.item_name && a.item_price === item.item_price);
            if (existing) { existing.quantity += item.quantity; }
            else { acc.push({ item_name: item.item_name, item_price: item.item_price, quantity: item.quantity, is_veg: item.is_veg }); }
            return acc;
          }, []);

          return (
            <div className="space-y-3">
              {/* Items list */}
              <div className="bg-surface-hover rounded-xl p-3 max-h-40 overflow-y-auto space-y-1.5">
                {merged.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={item.is_veg ? "veg-dot flex-shrink-0" : "non-veg-dot flex-shrink-0"} />
                    <span className="flex-1 text-foreground text-sm">{item.item_name}</span>
                    <span className="text-muted-foreground text-sm font-bold w-6 text-center">{item.quantity}×</span>
                    <span className="text-foreground text-sm font-semibold min-w-[52px] text-right">{formatCurrency(item.item_price * item.quantity)}</span>
                  </div>
                ))}
                {merged.length === 0 && <p className="text-muted-foreground text-xs text-center py-2">No items</p>}
              </div>

              {/* Discount input */}
              <div className="bg-surface-hover/60 rounded-xl px-3 py-2.5 space-y-2">
                <div className="text-xs text-muted-foreground font-semibold">Apply Discount</div>
                <div className="flex gap-2">
                  <div className="flex rounded-lg overflow-hidden border border-elevated flex-shrink-0">
                    <button onClick={() => setDiscountType("fixed")}
                      className={`px-2.5 py-1.5 text-xs font-bold transition-all ${discountType === "fixed" ? "bg-red-600 text-white" : "bg-elevated text-muted-foreground"}`}>
                      £
                    </button>
                    <button onClick={() => setDiscountType("pct")}
                      className={`px-2.5 py-1.5 text-xs font-bold transition-all ${discountType === "pct" ? "bg-red-600 text-white" : "bg-elevated text-muted-foreground"}`}>
                      %
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder={discountType === "fixed" ? "0.00" : "0"}
                    value={discountInput}
                    onChange={e => setDiscountInput(e.target.value)}
                    className="flex-1 bg-elevated border border-elevated rounded-lg px-3 py-1.5 text-foreground text-sm focus:outline-none focus:border-red-500"
                  />
                  <button
                    onClick={applyDiscount}
                    disabled={!discountInput || discountApplying}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    {discountApplying ? "…" : "Apply"}
                  </button>
                  {localDiscount > 0 && (
                    <button onClick={removeDiscount} disabled={discountApplying}
                      className="px-2.5 py-1.5 bg-elevated hover:bg-red-200 border border-elevated hover:border-red-300 text-muted-foreground hover:text-red-600 text-xs font-bold rounded-lg transition-all">
                      ✕
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Reason (optional) — e.g. goodwill, complaint, staff meal"
                  value={discountReasonInput}
                  onChange={e => setDiscountReasonInput(e.target.value)}
                  className="w-full bg-elevated border border-elevated rounded-lg px-3 py-1.5 text-foreground text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Loyalty reward code */}
              <div className="bg-surface-hover/60 rounded-xl px-3 py-2.5 space-y-2">
                <div className="text-xs text-muted-foreground font-semibold">Loyalty Reward Code</div>
                {appliedReward ? (
                  <div className="text-emerald-600 text-xs font-semibold">✓ {appliedReward} applied</div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 7K4M9PQ2"
                      value={rewardCodeInput}
                      onChange={(e) => setRewardCodeInput(e.target.value.toUpperCase())}
                      className="flex-1 bg-elevated border border-elevated rounded-lg px-3 py-1.5 text-foreground text-sm font-mono tracking-wider focus:outline-none focus:border-red-500"
                    />
                    <button
                      onClick={applyRewardCode}
                      disabled={!rewardCodeInput.trim() || rewardApplying}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-all"
                    >
                      {rewardApplying ? "…" : "Redeem"}
                    </button>
                  </div>
                )}
                {rewardError && <div className="text-red-600 text-xs">{rewardError}</div>}
              </div>

              {/* Service charge */}
              <div className="bg-surface-hover/60 rounded-xl px-3 py-2.5 space-y-2">
                <div className="text-xs text-muted-foreground font-semibold">Service Charge</div>
                <div className="flex gap-2">
                  {[0, 10, 12.5].map((pct) => (
                    <button key={pct} onClick={() => applyServiceCharge(pct)} disabled={serviceChargeApplying}
                      className="flex-1 py-1.5 bg-elevated hover:bg-red-600 hover:text-white border border-elevated rounded-lg text-foreground text-xs font-bold transition-all disabled:opacity-40">
                      {pct === 0 ? "None" : `${pct}%`}
                    </button>
                  ))}
                  <input type="number" min="0" max="100" placeholder="Custom %" value={serviceChargeInput}
                    onChange={(e) => setServiceChargeInput(e.target.value)}
                    className="w-20 bg-elevated border border-elevated rounded-lg px-2 py-1.5 text-foreground text-xs focus:outline-none focus:border-red-500" />
                  <button onClick={() => applyServiceCharge(Number(serviceChargeInput) || 0)} disabled={!serviceChargeInput || serviceChargeApplying}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-all">
                    Set
                  </button>
                </div>
              </div>

              {/* Split bill */}
              <div className="bg-surface-hover/60 rounded-xl px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">Split Bill</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSplitCount((n) => Math.max(1, n - 1)); setAmountOverride(null); }} className="h-9 w-9 rounded-full bg-elevated border border-elevated text-foreground">−</button>
                  <span className="text-foreground text-sm w-16 text-center">{splitCount === 1 ? "Full bill" : `${splitCount} ways`}</span>
                  <button onClick={() => { setSplitCount((n) => n + 1); setAmountOverride(null); }} className="h-9 w-9 rounded-full bg-elevated border border-elevated text-foreground">+</button>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-surface-hover/60 rounded-xl px-4 py-3 space-y-1">
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
                </div>
                {localDiscount > 0 && (
                  <div className="flex justify-between text-yellow-600 text-xs">
                    <span>Discount</span><span>−{formatCurrency(localDiscount)}</span>
                  </div>
                )}
                {localServiceCharge > 0 && (
                  <div className="flex justify-between text-purple-700 text-xs">
                    <span>Service Charge</span><span>{formatCurrency(localServiceCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-foreground font-bold text-base border-t border-border pt-1.5 mt-1">
                  <span>Bill Total</span>
                  <span className="text-red-600 text-xl">{formatCurrency(localTotal)}</span>
                </div>
                <div className="text-right text-muted-foreground text-[10px]">incl. VAT {formatCurrency(localTax)}</div>
                {loyaltyPreview && (
                  <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 mt-1">
                    <span className="text-rose-800 text-[11px] font-medium truncate">🎁 {loyaltyPreview.customerName} · {loyaltyPreview.currentBalance} pts{loyaltyPreview.tierName ? ` · ${loyaltyPreview.tierName}` : ""}</span>
                    {loyaltyPreview.willEarn > 0 && <span className="text-rose-700 text-[11px] font-bold flex-shrink-0 ml-2">+{loyaltyPreview.willEarn} this visit</span>}
                  </div>
                )}
                {remainingBalance < localTotal - 0.01 && (
                  <div className="flex justify-between text-emerald-600 text-xs">
                    <span>Already paid</span><span>{formatCurrency(localTotal - remainingBalance)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-foreground font-bold text-sm">
                  <span>{splitCount > 1 ? `This payment (1 of ${splitCount})` : "Amount Due"}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-red-600">£</span>
                    <input
                      type="number" min="0" max={remainingBalance} step="0.01"
                      value={amountOverride !== null ? amountOverride : amountDue.toFixed(2)}
                      onChange={(e) => setAmountOverride(e.target.value)}
                      className="w-20 bg-elevated border border-elevated rounded-lg px-2 py-1 text-red-600 text-sm font-bold text-right focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>
                <p className="text-muted-foreground text-[11px]">Edit to charge a different amount now — e.g. part cash, rest on card.</p>
              </div>

              {/* Tip */}
              <div className="bg-surface-hover/60 rounded-xl px-3 py-2.5 space-y-2">
                <div className="text-xs text-muted-foreground font-semibold">Add Tip</div>
                <div className="flex gap-2">
                  {tipPresets.map(({ pct, amount }) => (
                    <button key={pct} onClick={() => setTipInput(amount ? amount.toFixed(2) : "")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${tipInput === (amount ? amount.toFixed(2) : "") ? "bg-red-600 border-red-500 text-white" : "bg-elevated border-elevated text-foreground"}`}>
                      {pct === 0 ? "None" : `${pct}%`}
                    </button>
                  ))}
                  <input type="number" min="0" step="0.01" placeholder="£ custom" value={tipInput}
                    onChange={(e) => setTipInput(e.target.value)}
                    className="w-20 bg-elevated border border-elevated rounded-lg px-2 py-1.5 text-foreground text-xs focus:outline-none focus:border-red-500" />
                </div>
              </div>

              <div className="text-muted-foreground text-sm font-medium text-center">Select Payment Method</div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setMethod("cash"); setStep("cash_amount"); }}
                  className="pos-btn no-select flex flex-col items-center gap-2 p-5 bg-green-100 hover:bg-green-200 border-2 border-green-300 rounded-xl text-green-700 transition-all">
                  <span className="text-3xl">💵</span>
                  <span className="font-bold text-lg">CASH</span>
                </button>
                <button onClick={() => { setMethod("card"); setStep("card_confirm"); }}
                  className="pos-btn no-select flex flex-col items-center gap-2 p-5 bg-blue-100 hover:bg-blue-200 border-2 border-blue-300 rounded-xl text-blue-700 transition-all">
                  <span className="text-3xl">💳</span>
                  <span className="font-bold text-lg">CARD</span>
                </button>
              </div>

              <button onClick={() => setStep("pay_later_confirm")}
                className="pos-btn no-select w-full flex items-center justify-center gap-2 py-3 bg-amber-100 hover:bg-amber-200 border-2 border-amber-300 rounded-xl text-amber-700 transition-all">
                <span className="text-xl">📌</span>
                <span className="font-bold text-sm">PAY LATER — card declined / customer will return</span>
              </button>

              {error && <div className="text-red-600 text-sm text-center">{error}</div>}
            </div>
          );
        })()}

        {/* Cash Amount Entry */}
        {step === "cash_amount" && (
          <div className="space-y-4">
            <div className="bg-surface-hover rounded-xl p-4 flex justify-between items-center">
              <div>
                <div className="text-muted-foreground text-sm">To Pay{tipAmount > 0 && ` (+${formatCurrency(tipAmount)} tip)`}</div>
                <div className="text-red-600 text-2xl font-bold">
                  {formatCurrency(amountDue + tipAmount)}
                </div>
              </div>
              {cashAmount > 0 && (
                <div className="text-right">
                  <div className="text-muted-foreground text-sm">Change</div>
                  <div
                    className={`text-2xl font-bold ${change >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {formatCurrency(change)}
                  </div>
                </div>
              )}
            </div>

            {/* Cash amount display */}
            <div className="bg-surface-hover border border-elevated rounded-xl p-4 text-center">
              <div className="text-muted-foreground text-sm mb-1">Cash Received</div>
              <div className="text-foreground text-3xl font-mono font-bold">
                £{cashInput || "0.00"}
              </div>
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setCashInput(amt.toFixed(2))}
                  className="pos-btn no-select py-2 bg-elevated hover:bg-elevated-hover border border-elevated rounded-lg text-foreground text-sm font-semibold"
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
                    className="pos-btn no-select h-12 bg-surface-hover hover:bg-elevated border border-elevated rounded-lg text-foreground font-bold text-lg"
                  >
                    {d}
                  </button>
                )
              )}
              <button
                onClick={handleCashBackspace}
                className="pos-btn no-select h-12 bg-surface-hover hover:bg-elevated border border-elevated rounded-lg text-muted-foreground font-bold text-lg"
              >
                ⌫
              </button>
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setStep("method"); setCashInput(""); }}
                className="pos-btn no-select h-12 bg-elevated hover:bg-elevated-hover border border-elevated rounded-xl text-foreground font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => handleProcessPayment()}
                disabled={cashAmount <= 0 || loading}
                className="pos-btn no-select h-12 bg-green-600 hover:bg-green-500 disabled:bg-elevated disabled:text-muted-foreground text-white font-bold rounded-xl transition-all"
              >
                {loading ? "Processing..." : cashAmount > 0 && cashAmount < amountDue + tipAmount ? `Confirm £${cashAmount.toFixed(2)} — Rest by Card/Cash` : "Confirm Payment"}
              </button>
            </div>
          </div>
        )}

        {/* Card Confirm */}
        {step === "card_confirm" && (
          <div className="space-y-4">
            <div className="bg-blue-100 border border-blue-300 rounded-xl p-6 text-center">
              <div className="text-5xl mb-3">{terminalStatus === "processing" ? "📡" : "💳"}</div>
              <div className="text-foreground text-sm mb-1">
                {terminalStatus === "processing" ? "Waiting for card on reader…" : "Present card terminal for"}
              </div>
              <div className="text-foreground text-4xl font-bold">
                {formatCurrency(amountDue + tipAmount)}
              </div>
              {tipAmount > 0 && <div className="text-muted-foreground text-xs mt-1">(includes {formatCurrency(tipAmount)} tip)</div>}
            </div>

            <div className="bg-surface-hover rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-foreground">
                <span>{splitCount > 1 ? `This payment (1 of ${splitCount})` : "Amount Due"}</span><span>{formatCurrency(amountDue)}</span>
              </div>
              <div className="flex justify-between text-foreground font-bold border-t border-elevated pt-2">
                <span>Total (incl. tip)</span><span className="text-red-600">{formatCurrency(amountDue + tipAmount)}</span>
              </div>
            </div>

            {(error || terminalError) && (
              <div className="text-red-600 text-sm text-center">{error || terminalError}</div>
            )}

            {readerEnabled && !useManualCard ? (
              <>
                {terminalStatus === "idle" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setStep("method")}
                      className="pos-btn no-select h-12 bg-elevated hover:bg-elevated-hover border border-elevated rounded-xl text-foreground font-semibold"
                    >
                      Back
                    </button>
                    <button
                      onClick={startTerminalCharge}
                      className="pos-btn no-select h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all"
                    >
                      📡 Charge Card Reader
                    </button>
                  </div>
                )}
                {terminalStatus === "processing" && (
                  <button
                    onClick={cancelTerminalCharge}
                    className="pos-btn no-select w-full h-12 bg-elevated hover:bg-red-100 hover:text-red-700 border border-elevated rounded-xl text-foreground font-semibold"
                  >
                    Cancel
                  </button>
                )}
                {terminalStatus === "failed" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setTerminalStatus("idle")}
                      className="pos-btn no-select h-12 bg-elevated hover:bg-elevated-hover border border-elevated rounded-xl text-foreground font-semibold"
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => { setUseManualCard(true); setTerminalStatus("idle"); setTerminalError(""); }}
                      className="pos-btn no-select h-12 bg-elevated hover:bg-elevated-hover border border-elevated rounded-xl text-foreground font-semibold text-sm"
                    >
                      Enter Manually
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setStep("method")}
                  className="pos-btn no-select h-12 bg-elevated hover:bg-elevated-hover border border-elevated rounded-xl text-foreground font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={() => handleProcessPayment()}
                  disabled={loading}
                  className="pos-btn no-select h-12 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
                >
                  {loading ? "Processing..." : "Card Paid ✓"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pay Later confirm */}
        {step === "pay_later_confirm" && (
          <div className="space-y-4">
            <div className="bg-amber-100 border border-amber-300 rounded-xl p-6 text-center">
              <div className="text-5xl mb-2">📌</div>
              <div className="text-amber-700 text-lg font-bold">Mark this order Pay Later?</div>
              <div className="text-foreground text-2xl font-bold mt-1">{formatCurrency(remainingBalance)}</div>
              <p className="text-muted-foreground text-xs mt-2">
                No payment is taken now. The order stays on record as owed, and will show up in
                Order History → Pending Bills until it's paid.
              </p>
            </div>
            <input
              type="text"
              placeholder="Reason (optional) — e.g. card declined, will return Friday"
              value={payLaterNote}
              onChange={(e) => setPayLaterNote(e.target.value)}
              className="w-full bg-elevated border border-elevated rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-amber-500"
            />
            {error && <div className="text-red-600 text-sm text-center">{error}</div>}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStep("method")}
                className="pos-btn no-select h-12 bg-elevated hover:bg-elevated-hover border border-elevated rounded-xl text-foreground font-semibold"
              >
                Back
              </button>
              <button
                onClick={handlePayLater}
                disabled={loading}
                className="pos-btn no-select h-12 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
              >
                {loading ? "Saving…" : "Confirm Pay Later"}
              </button>
            </div>
          </div>
        )}

        {/* Pay Later confirmed */}
        {step === "pay_later_done" && (
          <div className="space-y-4">
            <div className="bg-amber-100 border border-amber-300 rounded-xl p-6 text-center">
              <div className="text-5xl mb-2">📌</div>
              <div className="text-amber-700 text-xl font-bold">Marked Pay Later</div>
              <div className="text-foreground text-sm mt-2">Find it later in Order History → Pending Bills to take payment.</div>
            </div>
            <button
              onClick={handleClose}
              className="pos-btn no-select w-full h-12 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl"
            >
              New Order
            </button>
          </div>
        )}

        {/* Partial payment recorded — bill not fully settled yet */}
        {step === "partial" && (
          <div className="space-y-4">
            <div className="bg-amber-100 border border-amber-300 rounded-xl p-6 text-center">
              <div className="text-5xl mb-2">🧾</div>
              <div className="text-amber-600 text-xl font-bold">{formatCurrency(lastPaymentAmount)} Received</div>
              <div className="text-foreground text-sm mt-2">Remaining balance</div>
              <div className="text-foreground text-3xl font-bold">{formatCurrency(remainingBalance)}</div>
            </div>
            <button
              onClick={() => { setStep("method"); setSplitCount(Math.max(1, splitCount - 1)); }}
              className="pos-btn no-select w-full h-12 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl"
            >
              Take Next Payment
            </button>
            <button
              onClick={handleClose}
              className="pos-btn no-select w-full h-11 bg-elevated hover:bg-elevated-hover border border-elevated text-foreground font-semibold rounded-xl"
            >
              Close (collect rest later)
            </button>
          </div>
        )}

        {/* Receipt */}
        {step === "receipt" && (
          <div className="space-y-4">
            <div className="bg-green-100 border border-green-300 rounded-xl p-6 text-center">
              <div className="text-5xl mb-2">✅</div>
              <div className="text-green-600 text-xl font-bold">Payment Successful!</div>
            </div>

            <div className="bg-surface-hover rounded-xl p-4 font-mono text-sm">
              <div className="text-center text-foreground font-bold mb-2">
                THE ROYAL CHILLI
              </div>
              <div className="text-center text-muted-foreground text-xs mb-3">
                43 Kingsley Road, Hounslow TW3 1PA
              </div>
              <div className="border-t border-dashed border-elevated pt-2 space-y-1">
                {items.filter(i => !i.voided).map((item, i) => (
                  <div key={i} className="flex justify-between text-foreground text-xs">
                    <span>{item.quantity}x {item.item_name}</span>
                    <span>{formatCurrency(item.item_price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-elevated mt-2 pt-2 space-y-1">
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
                </div>
                {localDiscount > 0 && (
                  <div className="flex justify-between text-yellow-600 text-xs">
                    <span>Discount</span><span>−{formatCurrency(localDiscount)}</span>
                  </div>
                )}
                {localServiceCharge > 0 && (
                  <div className="flex justify-between text-purple-700 text-xs">
                    <span>Service Charge</span><span>{formatCurrency(localServiceCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-foreground font-bold">
                  <span>TOTAL</span><span>{formatCurrency(localTotal)}</span>
                </div>
                <div className="text-right text-muted-foreground text-[10px]">incl. VAT {formatCurrency(localTax)}</div>
                {tipAmount > 0 && (
                  <div className="flex justify-between text-red-700 text-xs font-semibold">
                    <span>Tip</span><span>{formatCurrency(tipAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-foreground text-xs">
                  <span>Paid by</span>
                  <span className="capitalize">{method}</span>
                </div>
                {method === "cash" && (
                  <>
                    <div className="flex justify-between text-foreground text-xs">
                      <span>Cash given</span><span>{formatCurrency(cashAmount)}</span>
                    </div>
                    <div className="flex justify-between text-green-600 text-xs font-semibold">
                      <span>Change</span><span>{formatCurrency(change)}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="text-center text-muted-foreground text-xs mt-3">
                Thank you for visiting!<br />
                {new Date().toLocaleString("en-GB")}
              </div>
            </div>

            <button
              onClick={handleClose}
              className="pos-btn no-select w-full h-12 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl"
            >
              New Order
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
