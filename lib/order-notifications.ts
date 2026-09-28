import supabase from "@/lib/supabase";
import { sendOrderReadyEmail, sendReviewRequestEmail } from "@/lib/email";
import { tradingDayStr, tradingRangeUtc } from "@/lib/london-date";

// Customer emails that follow an order (Batch 4). Each is "claimed" on the
// order row first (ready_notified_at / review_requested_at, migration 065)
// and only sent if the claim wins, so a re-bumped ticket or a re-run cron can
// never send the same email twice.

type ReadyOrder = {
  id: number;
  order_number: string;
  order_type: string;
  staff_id: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customers: { email: string | null } | null;
};

// "Your order is ready" — website collection and delivery orders (placed by
// the customer, so no staff_id), once, when the kitchen marks it ready.
export async function notifyOrderReady(orderId: number): Promise<void> {
  try {
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, order_type, staff_id, customer_name, customer_email, customers(email)")
      .eq("id", orderId)
      .is("ready_notified_at", null)
      .maybeSingle();
    const order = data as unknown as ReadyOrder | null;
    if (!order || order.staff_id || (order.order_type !== "takeaway" && order.order_type !== "delivery")) return;
    const email = order.customer_email || order.customers?.email;
    if (!email) return;

    const { data: claimed } = await supabase
      .from("orders")
      .update({ ready_notified_at: new Date().toISOString() })
      .eq("id", orderId)
      .is("ready_notified_at", null)
      .select("id");
    if (!claimed?.length) return;

    await sendOrderReadyEmail(email, { customerName: order.customer_name || "there", orderNumber: order.order_number, orderType: order.order_type });
  } catch (err) {
    console.error("Order-ready email failed for order", orderId, err);
  }
}

type ReviewOrder = {
  id: number;
  customer_name: string | null;
  customer_email: string | null;
  customers: { name: string | null; email: string | null; marketing_consent: boolean } | null;
};

// "How was your meal?" — for yesterday's trading day, one email per customer
// who opted in to hear from us (customers.marketing_consent), and only once a
// Google review link is set in Staff Hub → Settings. Returns how many sent.
export async function sendReviewRequests(now: Date = new Date()): Promise<{ sent: number; skipped: string | null }> {
  const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "google_review_url").maybeSingle();
  const reviewUrl = typeof setting?.value === "string" ? setting.value.trim() : "";
  if (!/^https:\/\//.test(reviewUrl)) return { sent: 0, skipped: "No Google review link set" };

  const today = tradingDayStr(now);
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  const { start, end } = tradingRangeUtc(y.toISOString().slice(0, 10));

  const { data } = await supabase
    .from("orders")
    .select("id, customer_name, customer_email, customers(name, email, marketing_consent)")
    .eq("is_paid", true)
    .is("review_requested_at", null)
    .not("customer_id", "is", null)
    .gte("created_at", start)
    .lte("created_at", end);

  const byEmail = new Map<string, { name: string; ids: number[] }>();
  for (const o of (data ?? []) as unknown as ReviewOrder[]) {
    if (!o.customers?.marketing_consent) continue;
    const email = (o.customers.email || o.customer_email || "").trim().toLowerCase();
    if (!email) continue;
    const entry = byEmail.get(email) ?? { name: o.customers.name || o.customer_name || "there", ids: [] };
    entry.ids.push(o.id);
    byEmail.set(email, entry);
  }

  let sent = 0;
  for (const [email, { name, ids }] of byEmail) {
    const { data: claimed } = await supabase
      .from("orders")
      .update({ review_requested_at: new Date().toISOString() })
      .in("id", ids)
      .is("review_requested_at", null)
      .select("id");
    if (!claimed?.length) continue;
    await sendReviewRequestEmail(email, { customerName: name, reviewUrl });
    sent++;
  }
  return { sent, skipped: null };
}
