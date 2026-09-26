import { NextRequest, NextResponse } from "next/server";
import { isPrintStation } from "@/lib/print-station";
import { markPrinted } from "@/lib/print-queue";

// POST { id } — the Print Station has sent this job to the printer.
export async function POST(req: NextRequest) {
  if (!(await isPrintStation(req))) {
    return NextResponse.json({ error: "This computer isn't paired as the Print Station" }, { status: 401 });
  }
  const { id } = await req.json().catch(() => ({}));
  const jobId = Number(id);
  if (!Number.isInteger(jobId) || jobId <= 0) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await markPrinted(jobId);
  return NextResponse.json({ success: true });
}
