import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { allOwned, bizDb } from "@/lib/business-db";
import { canManageCrm } from "@/lib/permissions";
import { mergeCustomers } from "@/lib/customer-merge";

// POST { keep_id, drop_ids[] } — merge duplicate records into the one kept.
// Managers only; every merge is written to the audit log.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManageCrm(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const keepId = Number(b.keep_id);
  const dropIds: number[] = Array.isArray(b.drop_ids) ? b.drop_ids.map(Number).filter((n: number) => n && n !== keepId) : [];
  if (!(await allOwned(bizDb(session.businessId), "customers", [keepId, ...dropIds]))) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (!keepId || dropIds.length === 0) return NextResponse.json({ error: "Choose one record to keep and at least one to merge in" }, { status: 400 });

  for (const dropId of dropIds) {
    const r = await mergeCustomers(keepId, dropId, { staffId: session.id, reason: "merged by staff" });
    if (!r.ok) return NextResponse.json({ error: `#${dropId}: ${r.error}` }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
