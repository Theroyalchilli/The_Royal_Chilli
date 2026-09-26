import { NextRequest, NextResponse } from "next/server";
import { isPrintStation } from "@/lib/print-station";
import { nextDueJob } from "@/lib/print-queue";
import { BROWSER_TICKET_WIDTH } from "@/lib/ticket-html";

export const dynamic = "force-dynamic";

// GET — the Print Station's poll: the next ticket due, laid out for browser
// printing, or { job: null }. The job stays queued until the station reports
// it printed (POST ../done), so a laptop that drops mid-print retries it.
export async function GET(req: NextRequest) {
  if (!(await isPrintStation(req))) {
    return NextResponse.json({ error: "This computer isn't paired as the Print Station" }, { status: 401 });
  }
  const next = await nextDueJob(BROWSER_TICKET_WIDTH);
  if (!next) return NextResponse.json({ job: null });
  return NextResponse.json({
    job: { id: next.job.id, kind: next.job.kind, source: next.job.source },
    ticket: next.ticket,
  });
}
