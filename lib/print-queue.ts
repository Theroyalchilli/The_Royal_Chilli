import supabase from "@/lib/supabase";
import { bizDb } from "@/lib/business-db";
import { KITCHEN_LEAD_MINUTES } from "@/lib/scheduling";
import { buildTicket, LINE_WIDTH, type PrintJob, type Ticket } from "@/lib/cloudprnt";

// Each business prints only its own jobs: a print job takes its order's (or
// till shift's) business in the database (migration 076), and every printer
// and Print Station takes jobs for one business.
//
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

export async function queueZReport(workPeriodId: number) {
  const { error } = await supabase.from("print_jobs").insert({ work_period_id: workPeriodId, kind: "zreport" });
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

// ---------- taking jobs off the queue ----------
// Shared by the two things that print: the Star printer itself over the
// network (app/api/cloudprnt) and the USB Print Station page on the till
// laptop (app/api/print/station) — same order, same rules. Only one should
// be in use at a time, or a ticket can print twice.

// A ticket still unprinted after this long (printer off all day, say) is
// stale — printing yesterday's orders into a live kitchen does more harm
// than good.
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export const JOB_COLUMNS = "id, order_id, work_period_id, kind, source, item_ids";

export async function markPrinted(businessId: number, jobId: number) {
  await bizDb(businessId).from("print_jobs").update({ printed_at: new Date().toISOString() }).eq("id", jobId).is("printed_at", null);
}

// The next job that's due and still has something to print, laid out
// `width` columns wide. A job whose order was cancelled (or whose items all
// were) renders to nothing — it's closed off here so it can't block the queue.
export async function nextDueJob(businessId: number, width = LINE_WIDTH): Promise<{ job: PrintJob; ticket: Ticket } | null> {
  const now = Date.now();
  const { data: jobs } = await bizDb(businessId)
    .from("print_jobs")
    .select(JOB_COLUMNS)
    .is("printed_at", null)
    .lte("print_after", new Date(now).toISOString())
    .gte("print_after", new Date(now - STALE_AFTER_MS).toISOString())
    .order("print_after", { ascending: true })
    .order("id", { ascending: true })
    .limit(5);

  for (const job of (jobs ?? []) as PrintJob[]) {
    const ticket = await buildTicket(job, width);
    if (ticket) return { job, ticket };
    console.log(`[print] job ${job.id} (${job.kind} ${job.order_id ?? job.work_period_id}) has nothing to print — skipping`);
    await markPrinted(businessId, job.id);
  }
  return null;
}
