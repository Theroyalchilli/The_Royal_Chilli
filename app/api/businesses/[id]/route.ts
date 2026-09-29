import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { setBusinessOpen } from "@/lib/businesses-admin";
import { bizDb } from "@/lib/business-db";

// PATCH { active } — open a business or close it again. Owner only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session?.owner) return NextResponse.json({ error: "Only the owner can open or close a business" }, { status: 403 });
  const id = Number((await params).id);
  const { active } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id) || typeof active !== "boolean") return NextResponse.json({ error: "id and active are required" }, { status: 400 });
  const result = await setBusinessOpen(id, active);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  await bizDb(id).from("audit_logs").insert({
    staff_id: session.id, action: active ? "business_opened" : "business_closed", entity_type: "business", entity_id: id, changes: { active },
  });
  return NextResponse.json({ success: true });
}
