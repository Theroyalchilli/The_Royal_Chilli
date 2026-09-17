"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { formatCurrency, isValidEmail, isValidUkMobile } from "@/lib/utils";
import { readCart, readOrderType, writeOrderType, type CartLine, type OrderType } from "@/lib/cart";
import { isRestaurantOpen, formatHoursForDate, getScheduleSlotOptions, nextValidScheduleSlot, toDateInputValue, toDateTimeInputValue } from "@/lib/hours";
import { MAX_ADVANCE_DAYS } from "@/lib/scheduling";
import { computeDeliveryFee, FREE_DELIVERY_THRESHOLD, MIN_DELIVERY_ORDER } from "@/lib/delivery-zones";

type ZoneCheck = { deliverable: boolean };

// Hidden entirely (falls back to pay-on-collection/delivery only) until
// STRIPE_SECRET_KEY + the Stripe webhook are configured server-side — this
// flag just needs to be flipped on once that's done.
const STRIPE_ENABLED = process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true";

function defaultScheduleDate() {
  return toDateInputValue(nextValidScheduleSlot(new Date()));
}
function defaultScheduleTime() {
  return toDateTimeInputValue(nextValidScheduleSlot(new Date()));
}
function maxScheduleDate() {
  const d = new Date();
  d.setDate(d.getDate() + MAX_ADVANCE_DAYS);
  return toDateInputValue(d);
}

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("takeaway");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [payOnline, setPayOnline] = useState(false);
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [zoneCheck, setZoneCheck] = useState<ZoneCheck | null>(null);
  const [checkingZone, setCheckingZone] = useState(false);
  const [notes, setNotes] = useState("");
  const [openNow, setOpenNow] = useState(true);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(defaultScheduleDate());
  const [scheduleTime, setScheduleTime] = useState(defaultScheduleTime());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{ orderNumber: string; total: number; scheduledFor: string | null }>({ orderNumber: "", total: 0, scheduledFor: null });
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setCart(readCart());
    setOrderType(readOrderType());
  }, []);

  // Starts assuming open (matches server render) and corrects after mount —
  // avoids a hydration mismatch from checking the real clock during render.
  useEffect(() => {
    const open = isRestaurantOpen();
    setOpenNow(open);
    if (!open) setIsScheduled(true);
  }, []);

  // Cart starts empty and only populates a moment after mount, so the page's
  // height (and the order-summary box specifically) changes right after the
  // initial paint. On some mobile browsers that late layout shift — combined
  // with scroll anchoring — leaves the page scrolled partway down instead of
  // at the top. Force it back to the top both on mount and again once the
  // cart data lands, to cover the page before and after that shift.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [cart]);

  function selectOrderType(type: OrderType) {
    setOrderType(type);
    writeOrderType(type);
  }

  const subtotal = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0);
  const deliveryFee = orderType === "delivery" && zoneCheck?.deliverable ? computeDeliveryFee(subtotal) : 0;
  const total = subtotal + deliveryFee;

  // Re-derived whenever the picked date changes, since Friday's opening
  // time differs from every other day's (and "today" also excludes any
  // slot too soon to prepare).
  const scheduleSlots = getScheduleSlotOptions(new Date(`${scheduleDate}T00:00:00`));

  // Keep the selected time inside the current date's valid slots — e.g.
  // switching from a day open 9am to Friday (opens 11am) could otherwise
  // leave a 9:00/9:15/9:30/9:45 selection that Friday doesn't actually offer.
  useEffect(() => {
    if (scheduleSlots.length > 0 && !scheduleSlots.some((s) => s.value === scheduleTime)) {
      setScheduleTime(scheduleSlots[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleDate]);

  async function checkPostcode(pc: string) {
    setZoneCheck(null);
    if (!pc.trim()) return;
    setCheckingZone(true);
    try {
      const res = await fetch(`/api/public/delivery-zones/check?postcode=${encodeURIComponent(pc.trim())}`);
      setZoneCheck(await res.json());
    } catch {
      setZoneCheck(null);
    } finally {
      setCheckingZone(false);
    }
  }

  async function submitOrder() {
    setError("");
    if (cart.length === 0) return setError("Your cart is empty.");
    if (!name.trim() || !phone.trim() || !email.trim()) return setError("Please enter your name, phone number, and email.");
    if (!isValidUkMobile(phone)) return setError("Please enter a valid UK mobile number (starts with 07, 11 digits).");
    if (!isValidEmail(email)) return setError("Please enter a valid email address.");
    if (orderType === "delivery" && (!address.trim() || !postcode.trim())) return setError("Please enter a delivery address and postcode.");
    if (orderType === "delivery" && zoneCheck && !zoneCheck.deliverable) return setError("Sorry, we don't currently deliver to that postcode — we deliver within 5 miles of the restaurant.");
    if (orderType === "delivery" && zoneCheck?.deliverable && subtotal < MIN_DELIVERY_ORDER) {
      return setError(`Minimum order for delivery is £${MIN_DELIVERY_ORDER.toFixed(2)}.`);
    }
    if (!isScheduled && !openNow) return setError("We're closed right now — please schedule your order for later.");

    let scheduledFor: string | undefined;
    if (isScheduled) {
      if (!scheduleDate || !scheduleTime) return setError("Please choose a date and time.");
      // scheduleTime is already a full "YYYY-MM-DDTHH:MM" (not just a time) —
      // a post-midnight slot falls on the day after scheduleDate, and its
      // value already reflects that correctly.
      const scheduledDate = new Date(`${scheduleTime}:00`);
      scheduledFor = scheduledDate.toISOString();
      if (scheduledDate.getTime() - Date.now() < 20 * 60_000) {
        return setError("Please choose a time at least 20 minutes from now.");
      }
      if (!isRestaurantOpen(scheduledDate)) {
        return setError(`We're closed at that time — opening hours that day are ${formatHoursForDate(scheduledDate)}.`);
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_type: orderType,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_email: email.trim(),
          marketing_consent: marketingConsent,
          customer_address: orderType === "delivery" ? address.trim() : undefined,
          customer_postcode: orderType === "delivery" ? postcode.trim() : undefined,
          notes: notes.trim() || undefined,
          scheduled_for: scheduledFor,
          pay_online: payOnline && STRIPE_ENABLED,
          items: cart.map((c) => ({ menu_item_id: c.menu_item_id, quantity: c.quantity, selected_options: c.selectedOptions.map((o) => o.id), notes: c.notes })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place order");

      if (payOnline && STRIPE_ENABLED) {
        const sessionRes = await fetch(`/api/public/orders/${data.id}/checkout-session`, { method: "POST" });
        const sessionData = await sessionRes.json();
        if (!sessionRes.ok || !sessionData.url) throw new Error(sessionData.error || "Failed to start online payment");
        localStorage.removeItem("rc_cart");
        window.location.href = sessionData.url;
        return;
      }

      localStorage.removeItem("rc_cart");
      setConfirmation({ orderNumber: data.order_number, total: data.total, scheduledFor: data.scheduled_for });
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="mt-4 font-[family-name:var(--font-playfair)] text-2xl">Order Confirmed!</h1>
        <p className="mt-2 text-muted-foreground">
          Order <strong className="text-primary">{confirmation.orderNumber}</strong> is being prepared.
        </p>
        <p className="mt-1 text-muted-foreground">Total: {formatCurrency(confirmation.total)}</p>
        {confirmation.scheduledFor ? (
          <p className="mt-1 text-muted-foreground">
            {orderType === "delivery" ? "Delivery" : "Collection"} scheduled for{" "}
            {new Date(confirmation.scheduledFor).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Please have {orderType === "delivery" ? "cash or card ready for the driver" : "cash or card ready when you collect"}.
          </p>
        )}
        <Link
          href="/"
          className="mt-8 inline-block border border-primary px-8 py-3 text-xs uppercase tracking-[0.15em] text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Link
          href="/order"
          className="mt-4 inline-block border border-primary px-8 py-3 text-xs uppercase tracking-[0.15em] text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="flex items-center gap-3">
        <Link href="/order/cart" aria-label="Back to your order" className="flex h-8 w-8 items-center justify-center rounded-full border border-border hover:border-primary">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="font-[family-name:var(--font-playfair)] text-3xl">Checkout</h1>
      </div>

      <div className="mt-6 flex gap-3">
        {(["takeaway", "delivery"] as const).map((t) => (
          <button
            key={t}
            onClick={() => selectOrderType(t)}
            className={`flex-1 border px-4 py-2 text-xs uppercase tracking-[0.1em] ${
              orderType === t ? "border-primary bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {t === "takeaway" ? "Collection" : "Delivery"}
          </button>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        {([false, true] as const).map((scheduled) => {
          const disabled = !scheduled && !openNow;
          return (
            <button
              key={String(scheduled)}
              onClick={() => !disabled && setIsScheduled(scheduled)}
              disabled={disabled}
              className={`flex-1 border px-4 py-2 text-xs uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-40 ${
                isScheduled === scheduled ? "border-primary bg-primary text-primary-foreground" : "border-border"
              }`}
            >
              {scheduled ? "Schedule for later" : openNow ? "ASAP" : "ASAP (closed)"}
            </button>
          );
        })}
      </div>
      {!openNow && (
        <p className="mt-2 text-xs text-muted-foreground">
          We&apos;re closed right now — please choose a time to schedule your order for.
        </p>
      )}
      {isScheduled && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input
            type="date"
            value={scheduleDate}
            min={defaultScheduleDate()}
            max={maxScheduleDate()}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
          />
          <select
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            className="w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
          >
            {scheduleSlots.length === 0 ? (
              <option value="">No slots left today</option>
            ) : (
              scheduleSlots.map((slot) => (
                <option key={slot.value} value={slot.value}>{slot.label}</option>
              ))
            )}
          </select>
        </div>
      )}
      {isScheduled && scheduleSlots.length === 0 && (
        <p className="mt-2 text-xs text-red-500">No more slots today — please choose a different date.</p>
      )}

      <div className="mt-6 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Mobile number (07…)"
          type="tel"
          inputMode="numeric"
          maxLength={11}
          className="w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email to get order confirmation"
          type="email"
          required
          className="w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
        />
        <label className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} className="mt-0.5" />
          <span>Email me offers, rewards updates and news from The Royal Chilli</span>
        </label>
        {orderType === "delivery" && (
          <>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Delivery address"
              rows={2}
              className="w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
            />
            <input
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              onBlur={() => checkPostcode(postcode)}
              placeholder="Postcode"
              className="w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
            />
            {checkingZone && <p className="text-xs text-muted-foreground">Checking delivery availability…</p>}
            {!checkingZone && zoneCheck && (
              zoneCheck.deliverable ? (
                <p className="text-xs text-primary">
                  ✓ We deliver here · {formatCurrency(computeDeliveryFee(subtotal))} delivery fee (free over £{FREE_DELIVERY_THRESHOLD})
                  · £{MIN_DELIVERY_ORDER.toFixed(2)} minimum order
                </p>
              ) : (
                <p className="text-xs text-red-500">Sorry, we don&apos;t deliver there — we deliver within 5 miles of the restaurant.</p>
              )
            )}
          </>
        )}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
        />
      </div>

      {STRIPE_ENABLED && (
        <div className="mt-6 flex gap-3">
          {([false, true] as const).map((online) => (
            <button
              key={String(online)}
              onClick={() => setPayOnline(online)}
              className={`flex-1 border px-4 py-2 text-xs uppercase tracking-[0.1em] ${
                payOnline === online ? "border-primary bg-primary text-primary-foreground" : "border-border"
              }`}
            >
              {online ? "Pay Online Now" : `Pay on ${orderType === "delivery" ? "Delivery" : "Collection"}`}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-1 border-t border-border pt-4 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {orderType === "delivery" && zoneCheck?.deliverable && (
          <div className="flex justify-between text-muted-foreground">
            <span>Delivery fee</span>
            <span>{deliveryFee > 0 ? formatCurrency(deliveryFee) : "Free"}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 font-semibold text-primary">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <button
        onClick={submitOrder}
        disabled={submitting || (orderType === "delivery" && (!zoneCheck || !zoneCheck.deliverable)) || (isScheduled && scheduleSlots.length === 0)}
        className="mt-6 w-full bg-primary px-6 py-3 text-xs uppercase tracking-[0.15em] text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Placing Order…" : payOnline ? `Continue to Payment · ${formatCurrency(total)}` : `Place Order · ${formatCurrency(total)}`}
      </button>
      {!payOnline && (
        <p className="mt-3 text-center text-xs text-muted-foreground">Pay by cash or card on {orderType === "delivery" ? "delivery" : "collection"}.</p>
      )}
    </div>
  );
}
