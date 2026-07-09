import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const orders = db
      .prepare(`
        SELECT o.*, rt.table_number, s.name as staff_name
        FROM orders o
        LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
        LEFT JOIN staff s ON o.staff_id = s.id
        WHERE o.status IN ('sent_to_kitchen', 'ready')
        ORDER BY o.created_at ASC
      `)
      .all() as Array<{ id: number; [key: string]: unknown }>;

    // Attach items to each order
    const ordersWithItems = orders.map((order) => {
      const items = db
        .prepare(
          "SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at"
        )
        .all(order.id);
      return { ...order, items };
    });

    return NextResponse.json({ orders: ordersWithItems });
  } catch (error) {
    console.error("Kitchen fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch kitchen orders" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const { orderId, status } = await req.json();
    const db = getDb();

    db.prepare(
      "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, orderId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Kitchen update error:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}
