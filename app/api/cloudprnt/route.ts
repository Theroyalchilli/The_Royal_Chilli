import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { buildTicket, toPlainText, toStarPrnt, type PrintJob, type Ticket } from "@/lib/cloudprnt";
import { JOB_COLUMNS, markPrinted, nextDueJob } from "@/lib/print-queue";
import { bizDb } from "@/lib/business-db";
import { DEFAULT_BUSINESS_ID } from "@/lib/business-id";

// Star CloudPRNT endpoint for the restaurant's one printer (Star mC-Print3).
// The printer polls this URL every few seconds — no local device or browser
// tab involved. Flow: POST (poll) -> "is there a job?" -> GET (fetch) ->
// "here's the ticket" -> DELETE (confirm) -> "mark it printed."
//
// Jobs come from the print_jobs queue (lib/print-queue.ts): kitchen tickets
// from the till, table QR and the website, customer receipts and Z reports.
//
// One printer per business: its Server URL carries ?b=<business id> (no b =
// The Royal Chilli, so the existing printer needs no change), and it only
// ever gets that business's jobs.
//
// The printer's requests are logged (except idle polls) so the first real
// test shows exactly which query params Star's firmware sends — the GET/
// DELETE param names below follow Star's CloudPRNT docs but haven't yet been
// checked against this printer.


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

function businessFor(req: NextRequest): number | null {
  const b = req.nextUrl.searchParams.get("b");
  if (b == null) return DEFAULT_BUSINESS_ID;
  const id = Number(b);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// Query params minus the key, for logs.
function paramsForLog(req: NextRequest): string {
  const p = new URLSearchParams(req.nextUrl.searchParams);
  p.delete("key");
  return p.toString();
}

async function jobFor(req: NextRequest, businessId: number): Promise<{ job: PrintJob; ticket: Ticket } | null> {
  const token = req.nextUrl.searchParams.get("token") || req.nextUrl.searchParams.get("jobToken");
  if (!token) return nextDueJob(businessId);
  const { data: job } = await bizDb(businessId).from("print_jobs").select(JOB_COLUMNS).eq("id", token).is("printed_at", null).maybeSingle();
  if (!job) return null;
  const ticket = await buildTicket(job as PrintJob);
  return ticket ? { job: job as PrintJob, ticket } : null;
}

const STARPRNT = "application/vnd.star.starprnt";

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const businessId = businessFor(req);
  if (!businessId) return unauthorized();

  const status = await req.json().catch(() => null);
  const statusCode: string | undefined = status?.statusCode;
  if (statusCode && !statusCode.startsWith("200")) {
    console.warn(`[cloudprnt] printer reports status "${statusCode}"`, JSON.stringify(status));
  }

  const next = await nextDueJob(businessId);
  if (!next) return NextResponse.json({ jobReady: false });

  console.log(`[cloudprnt] POST poll -> job ${next.job.id} ready (${next.job.kind} ${next.job.order_id ?? next.job.work_period_id})`, JSON.stringify(status));
  return NextResponse.json({ jobReady: true, mediaTypes: [STARPRNT, "text/plain"], jobToken: String(next.job.id) });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const businessId = businessFor(req);
  if (!businessId) return unauthorized();
  console.log(`[cloudprnt] GET ${paramsForLog(req)}`);

  const found = await jobFor(req, businessId);
  if (!found) return new NextResponse(null, { status: 404 });

  if (req.nextUrl.searchParams.get("type") === "text/plain") {
    return new NextResponse(toPlainText(found.ticket), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new NextResponse(Buffer.from(toStarPrnt(found.ticket)), { headers: { "Content-Type": STARPRNT } });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const businessId = businessFor(req);
  if (!businessId) return unauthorized();
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
    await markPrinted(businessId, Number(token));
  } else {
    // No token echoed back — the job it just printed is the one we'd have
    // served, i.e. the next due job.
    const next = await nextDueJob(businessId);
    if (next) await markPrinted(businessId, next.job.id);
  }
  return NextResponse.json({ success: true });
}
