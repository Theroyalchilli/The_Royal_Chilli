import supabase from "@/lib/supabase";
import { KITCHEN_LEAD_MINUTES } from "@/lib/scheduling";

// Queues tickets for the Star mC-Print3, which pulls them via CloudPRNT
// (app/api/cloudprnt) — the one printer handles kitchen tickets from the
// till, table QR and the website, plus customer receipts. Tickets are
// rendered when the printer fetches them (lib/cloudprnt.ts), so a queue row
// only says *what* to print.

export type PrintSource = "till" | "qr" | "online";

// A scheduled website order's ticket waits until the kitchen should start on
// it — the same moment it appears on the Kitchen Display.
export function printAfterFor(order: { order_type: string; scheduled_for: string | null }): string {
  if (!order.scheduled_for) return new Date().toISOString();
  const leadMinutes = KITCHEN_LEAD_MINUTES[order.order_type] ?? 30;
  const at = new Date(order.scheduled_for).getTime() - leadMinutes * 60_000;
  return new Date(Math.max(at, Date.now())).toISOString();
}

export async function queueKitchenTicket(
  orderId: number,
  source: PrintSource | null,
  opts: { itemIds?: number[]; printAfter?: string } = {}
) {
  const { error } = await supabase.from("print_jobs").insert({
    order_id: orderId,
    kind: "kot",
    source,
    item_ids: opts.itemIds ?? null,
    print_after: opts.printAfter ?? new Date().toISOString(),
  });
  if (error) throw error;
}

export async function queueReceipt(orderId: number) {
  const { error } = await supabase.from("print_jobs").insert({ order_id: orderId, kind: "receipt" });
  if (error) throw error;
}

// For callers where the order itself has already succeeded — a printer
// problem must never turn a placed order into an error for the customer or
// the till, so failures are logged, not thrown.
export async function queueKitchenTicketSafely(...args: Parameters<typeof queueKitchenTicket>) {
  try {
    await queueKitchenTicket(...args);
  } catch (err) {
    console.error(`Failed to queue kitchen ticket for order ${args[0]}:`, err);
  }
}
