import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import supabase from "@/lib/supabase";
import { buildTicket, toPlainText, toStarPrnt, type PrintJob, type Ticket } from "@/lib/cloudprnt";

// Star CloudPRNT endpoint for the restaurant's one printer (Star mC-Print3).
// The printer polls this URL every few seconds — no local device or browser
// tab involved. Flow: POST (poll) -> "is there a job?" -> GET (fetch) ->
// "here's the ticket" -> DELETE (confirm) -> "mark it printed."
//
// Jobs come from the print_jobs queue (lib/print-queue.ts): kitchen tickets
// from the till, table QR and the website, plus customer receipts.
//
// Only one printer is registered, so jobs aren't routed by printerMAC. If a
// second printer is ever added, this needs to key off printerMAC instead.
//
// The printer's requests are logged (except idle polls) so the first real
// test shows exactly which query params Star's firmware sends — the GET/
// DELETE param names below follow Star's CloudPRNT docs but haven't yet been
// checked against this printer.

// A ticket still unprinted after this long (printer off all day, say) is
// stale — printing yesterday's orders into a live kitchen does more harm
// than good.
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

// The printer's Server URL carries ?key=<CLOUDPRNT_KEY>; HTTP Basic auth
// (password = the key) is accepted too, for firmware that strips query
// strings. Fails CLOSED in production if the key isn't configured —
// otherwise anyone could read customers' names/phones/addresses off queued
// tickets, or mark them printed so they never come out.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function isAuthorized(req: NextRequest): boolean {
  const key = process.env.CLOUDPRNT_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      console.error("CLOUDPRNT_KEY is not set in production — refusing CloudPRNT request.");
      return false;
    }
    return true;
  }
  const queryKey = req.nextUrl.searchParams.get("key");
  if (queryKey && safeEqual(queryKey, key)) return true;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6), "base64").toString();
    const password = decoded.slice(decoded.indexOf(":") + 1);
    if (safeEqual(password, key)) return true;
  }
  return false;
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// Query params minus the key, for logs.
function paramsForLog(req: NextRequest): string {
  const p = new URLSearchParams(req.nextUrl.searchParams);
  p.delete("key");
  return p.toString();
}

const JOB_COLUMNS = "id, order_id, kind, source, item_ids";

async function markPrinted(jobId: number) {
  await supabase.from("print_jobs").update({ printed_at: new Date().toISOString() }).eq("id", jobId).is("printed_at", null);
}

// The next job that's due and still has something to print. A job whose
// order was cancelled (or whose items all were) renders to nothing — it's
// closed off here so it can't block the queue.
async function nextJob(): Promise<{ job: PrintJob; ticket: Ticket } | null> {
  const now = Date.now();
  const { data: jobs } = await supabase
    .from("print_jobs")
    .select(JOB_COLUMNS)
    .is("printed_at", null)
    .lte("print_after", new Date(now).toISOString())
    .gte("print_after", new Date(now - STALE_AFTER_MS).toISOString())
    .order("print_after", { ascending: true })
    .order("id", { ascending: true })
    .limit(5);

  for (const job of (jobs ?? []) as PrintJob[]) {
    const ticket = await buildTicket(job);
    if (ticket) return { job, ticket };
    console.log(`[cloudprnt] job ${job.id} (order ${job.order_id}) has nothing to print — skipping`);
    await markPrinted(job.id);
  }
  return null;
}

async function jobFor(req: NextRequest): Promise<{ job: PrintJob; ticket: Ticket } | null> {
  const token = req.nextUrl.searchParams.get("token") || req.nextUrl.searchParams.get("jobToken");
  if (!token) return nextJob();
  const { data: job } = await supabase.from("print_jobs").select(JOB_COLUMNS).eq("id", token).is("printed_at", null).maybeSingle();
  if (!job) return null;
  const ticket = await buildTicket(job as PrintJob);
  return ticket ? { job: job as PrintJob, ticket } : null;
}

const STARPRNT = "application/vnd.star.starprnt";

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  const status = await req.json().catch(() => null);
  const statusCode: string | undefined = status?.statusCode;
  if (statusCode && !statusCode.startsWith("200")) {
    console.warn(`[cloudprnt] printer reports status "${statusCode}"`, JSON.stringify(status));
  }

  const next = await nextJob();
  if (!next) return NextResponse.json({ jobReady: false });

  console.log(`[cloudprnt] POST poll -> job ${next.job.id} ready (${next.job.kind}, order ${next.job.order_id})`, JSON.stringify(status));
  return NextResponse.json({ jobReady: true, mediaTypes: [STARPRNT, "text/plain"], jobToken: String(next.job.id) });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  console.log(`[cloudprnt] GET ${paramsForLog(req)}`);

  const found = await jobFor(req);
  if (!found) return new NextResponse(null, { status: 404 });

  if (req.nextUrl.searchParams.get("type") === "text/plain") {
    return new NextResponse(toPlainText(found.ticket), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new NextResponse(Buffer.from(toStarPrnt(found.ticket)), { headers: { "Content-Type": STARPRNT } });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  console.log(`[cloudprnt] DELETE ${paramsForLog(req)}`);

  // "code" is the printer's result, e.g. "200 OK" or "510 Media Error".
  // Anything but 2xx leaves the job queued so it's retried on the next poll.
  const code = req.nextUrl.searchParams.get("code");
  if (code && !code.startsWith("2")) {
    console.error(`[cloudprnt] printer failed job: ${code}`);
    return NextResponse.json({ success: true });
  }

  const token = req.nextUrl.searchParams.get("token") || req.nextUrl.searchParams.get("jobToken");
  if (token) {
    await markPrinted(Number(token));
  } else {
    // No token echoed back — the job it just printed is the one we'd have
    // served, i.e. the next due job.
    const next = await nextJob();
    if (next) await markPrinted(next.job.id);
  }
  return NextResponse.json({ success: true });
}
