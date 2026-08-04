import Link from "next/link";
import type { Metadata } from "next";
import supabase from "@/lib/supabase";

export const metadata: Metadata = { robots: { index: false } };

// Landing page after a successful Stripe Checkout redirect. The webhook (not
// this page) is what actually marks the order paid — this just reads back
// whatever the DB shows by the time the customer lands here, which in
// practice is at or after that, since Stripe fires the webhook before or
// alongside redirecting the browser.
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

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="text-5xl">🎉</div>
      <h1 className="mt-4 font-[family-name:var(--font-playfair)] text-2xl font-bold">Payment Received!</h1>
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
      <Link href="/" className="mt-8 inline-block rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90">
        Back to Home
      </Link>
    </div>
  );
}
