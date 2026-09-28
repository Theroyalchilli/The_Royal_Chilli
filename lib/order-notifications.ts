import supabase from "@/lib/supabase";
import { sendOrderReadyEmail } from "@/lib/email";

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

// The day-after "how was your meal?" email now lives in lib/rewards-emails.ts
// (runDailyMemberEmails), alongside the first-visit thank-you that replaces it.
