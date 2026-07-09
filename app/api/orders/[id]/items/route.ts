import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const items = db
      .prepare(`
        SELECT oi.*, COALESCE(mi.is_veg, 0) as is_veg
        FROM order_items oi
        LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = ?
        ORDER BY oi.created_at
      `)
      .all(id);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Order items fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: orderId } = await params;
    const { itemId, status } = await req.json();

    const db = getDb();
    db.prepare(
      "UPDATE order_items SET status = ? WHERE id = ? AND order_id = ?"
    ).run(status, itemId, orderId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Order item update error:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}
