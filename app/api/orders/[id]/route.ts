import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();

    const order = db
      .prepare(`
        SELECT o.*, rt.table_number, s.name as staff_name
        FROM orders o
        LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
        LEFT JOIN staff s ON o.staff_id = s.id
        WHERE o.id = ?
      `)
      .get(id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const items = db
      .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at")
      .all(id);

    return NextResponse.json({ order, items });
  } catch (error) {
    console.error("Order fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
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

    const { id } = await params;
    const body = await req.json();
    const { status, discount, discount_reason, notes } = body;

    const db = getDb();

    const order = db
      .prepare("SELECT * FROM orders WHERE id = ?")
      .get(id) as { id: number; table_id: number | null; status: string } | undefined;

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (status) {
      db.prepare(
        "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(status, id);

      // Free table when order is paid or cancelled
      if ((status === "paid" || status === "cancelled") && order.table_id) {
        db.prepare(
          "UPDATE restaurant_tables SET status = 'available' WHERE id = ?"
        ).run(order.table_id);
      }
    }

    if (discount !== undefined) {
      const existing = db
        .prepare("SELECT subtotal FROM orders WHERE id = ?")
        .get(id) as { subtotal: number };
      const taxableAmount = existing.subtotal - discount;
      const tax = Math.round(taxableAmount * 0.2 * 100) / 100;
      const total = Math.round((taxableAmount + tax) * 100) / 100;

      db.prepare(
        `UPDATE orders SET discount = ?, discount_reason = ?, tax = ?, total = ?,
         notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ?`
      ).run(discount, discount_reason || null, tax, total, notes || null, id);
    }

    const updated = db
      .prepare(`
        SELECT o.*, rt.table_number, s.name as staff_name
        FROM orders o
        LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
        LEFT JOIN staff s ON o.staff_id = s.id
        WHERE o.id = ?
      `)
      .get(id);

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    console.error("Order update error:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();

    const order = db
      .prepare("SELECT * FROM orders WHERE id = ?")
      .get(id) as { id: number; table_id: number | null } | undefined;

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(id);

    if (order.table_id) {
      db.prepare("UPDATE restaurant_tables SET status = 'available' WHERE id = ?").run(order.table_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Order delete error:", error);
    return NextResponse.json(
      { error: "Failed to cancel order" },
      { status: 500 }
    );
  }
}
