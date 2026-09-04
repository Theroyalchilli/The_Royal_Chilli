import Link from "next/link";
import type { Metadata } from "next";
import supabase from "@/lib/supabase";

export const metadata: Metadata = { robots: { index: false } };

// Landing page after a SumUp Hosted Checkout redirect. SumUp only gives a
// single redirect_url (no separate success/cancel destinations the way
// Stripe Checkout did), so this page can't assume payment succeeded just
// because the customer landed here — it checks amount_paid against total
// itself. The webhook (not this page) is what actually marks the order
// paid; in practice that's already landed by the time the customer's
// browser gets redirected back, but if they abandoned the SumUp page
// instead of completing payment, amount_paid will still be short.
export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string }>;
}) {
  const { order_id } = await searchParams;
  const orderId = Number(order_id);

  const { data: order } = orderId
    ? await supabase.from("orders").select("order_number, total, order_type, scheduled_for, amount_paid").eq("id", orderId).single()
    : { data: null };

  const isPaid = !!order && Number(order.amount_paid) >= Number(order.total);

  if (order && !isPaid) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="text-5xl">⚠️</div>
        <h1 className="mt-4 font-[family-name:var(--font-playfair)] text-2xl">Payment Not Completed</h1>
        <p className="mt-2 text-muted-foreground">
          Order <strong className="text-primary">{order.order_number}</strong> hasn&apos;t been paid yet — it hasn&apos;t been sent to the kitchen.
        </p>
        <p className="mt-1 text-muted-foreground">Head back to checkout to try again, or pay at collection/delivery instead.</p>
        <Link
          href="/order/checkout"
          className="mt-8 inline-block border border-primary px-8 py-3 text-xs uppercase tracking-[0.15em] text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          Back to Checkout
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="text-5xl">🎉</div>
      <h1 className="mt-4 font-[family-name:var(--font-playfair)] text-2xl">Payment Received!</h1>
      {order ? (
        <>
          <p className="mt-2 text-muted-foreground">
            Order <strong className="text-primary">{order.order_number}</strong> is being prepared.
          </p>
          <p className="mt-1 text-muted-foreground">Total paid: £{Number(order.total).toFixed(2)}</p>
          {order.scheduled_for && (
            <p className="mt-1 text-muted-foreground">
              {order.order_type === "delivery" ? "Delivery" : "Collection"} scheduled for{" "}
              {new Date(order.scheduled_for).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-muted-foreground">Thanks — your payment was received.</p>
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
