import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";
import { getZReport } from "@/lib/z-report-db";
import { queueZReport } from "@/lib/print-queue";

type Ctx = { params: Promise<{ id: string }> };

function periodId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// GET — one shift's Z report (Finance → Z Reports "View").
export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageFinance(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = periodId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const report = await getZReport(id);
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ report });
}

// POST — print it on the Star printer. Any staff member: the till's End of
// Day screen prints the report of the shift it just closed (or an X report
// of the open one). Rendered when the printer fetches it (lib/cloudprnt.ts).
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = periodId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    await queueZReport(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Queue Z report error:", error);
    return NextResponse.json({ error: "Failed to send to printer" }, { status: 500 });
  }
}
