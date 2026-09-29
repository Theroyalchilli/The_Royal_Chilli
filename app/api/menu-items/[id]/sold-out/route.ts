import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { bizDb } from "@/lib/business-db";
import { getSessionFromRequest } from "@/lib/auth";
import { soldOutUntilTomorrow } from "@/lib/sold-out";

// POST { sold_out: boolean } — any staff member at the till marks a dish sold
// out (until 5am, the next trading day) or back on. The website menu is
// refreshed straight away; orders for a sold-out dish are refused anyway.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid dish" }, { status: 400 });
  const { sold_out } = await req.json().catch(() => ({}));

  const sold_out_until = sold_out ? soldOutUntilTomorrow() : null;
  const { data, error } = await bizDb(session.businessId).from("menu_items").update({ sold_out_until }).eq("id", id).select("id, name, sold_out_until").single();
  if (error || !data) return NextResponse.json({ error: "Failed to update" }, { status: 500 });

  revalidatePath("/order");
  return NextResponse.json({ item: data });
}
