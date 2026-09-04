import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";

// Star CloudPRNT protocol endpoint for the reception printer (Star
// mC-Print3). The printer itself polls this single URL every few seconds —
// no local device or browser tab involved. Flow: POST (poll) -> "is there a
// job?" -> GET (fetch) -> "here's the ticket text" -> DELETE (confirm) ->
// "got it, mark it printed."
//
// Only one printer is registered for this restaurant, so job lookup doesn't
// bother routing by printerMAC — it's always just "the oldest unprinted
// job." If a second CloudPRNT printer is ever added, this needs to key off
// printerMAC/uniqueID from the POST body instead.
//
// Star's own docs (developer guide PDF) weren't fully readable when this was
// built, so the exact query-param names CloudPRNT clients use on the GET/
// DELETE requests are a best-effort guess (checked defensively, falling back
// to "oldest pending job" either way) — worth re-checking against the real
// printer's request logs on first physical test.

async function oldestPendingJob() {
  const { data } = await supabase
    .from("print_jobs")
    .select("id, content")
    .is("printed_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function POST() {
  const job = await oldestPendingJob();
  if (!job) {
    return NextResponse.json({ jobReady: false });
  }
  return NextResponse.json({ jobReady: true, mediaTypes: ["text/plain"], jobToken: String(job.id) });
}

export async function GET(req: NextRequest) {
  const requestedToken = req.nextUrl.searchParams.get("jobToken") || req.nextUrl.searchParams.get("token");

  const job = requestedToken
    ? (await supabase.from("print_jobs").select("id, content").eq("id", requestedToken).is("printed_at", null).maybeSingle()).data
    : await oldestPendingJob();

  if (!job) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(job.content, { headers: { "Content-Type": "text/plain" } });
}

export async function DELETE(req: NextRequest) {
  const requestedToken = req.nextUrl.searchParams.get("jobToken") || req.nextUrl.searchParams.get("token");

  if (requestedToken) {
    await supabase.from("print_jobs").update({ printed_at: new Date().toISOString() }).eq("id", requestedToken);
  } else {
    const job = await oldestPendingJob();
    if (job) await supabase.from("print_jobs").update({ printed_at: new Date().toISOString() }).eq("id", job.id);
  }
  return NextResponse.json({ success: true });
}
