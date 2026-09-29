import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { DEFAULT_BUSINESS_ID } from "@/lib/business";
import { copyRewardsScheme } from "@/lib/businesses-admin";
import { bizDb } from "@/lib/business-db";

// POST — give a business with no rewards scheme a copy of Royal Chilli's. Owner only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session?.owner) return NextResponse.json({ error: "Only the owner can do this" }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid business" }, { status: 400 });
  const result = await copyRewardsScheme(DEFAULT_BUSINESS_ID, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  await bizDb(id).from("audit_logs").insert({
    staff_id: session.id, action: "rewards_scheme_copied", entity_type: "business", entity_id: id, changes: { from: DEFAULT_BUSINESS_ID, ...result.value },
  });
  return NextResponse.json(result.value);
}
