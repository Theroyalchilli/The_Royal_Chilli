import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { method, amount, change_given, reference } = await req.json();

    if (!method || !amount) {
      return NextResponse.json(
        { error: "Payment method and amount required" },
        { status: 400 }
      );
    }

    const db = getDb();

    const order = db
      .prepare("SELECT * FROM orders WHERE id = ?")
      .get(id) as { id: number; total: number; table_id: number | null; status: string } | undefined;

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status === "paid") {
      return NextResponse.json(
        { error: "Order already paid" },
        { status: 400 }
      );
    }

    // Record payment
    db.prepare(`
      INSERT INTO payments (order_id, method, amount, change_given, reference, staff_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, method, amount, change_given || 0, reference || null, session.id);

    // Mark order as paid
    db.prepare(
      "UPDATE orders SET status = 'paid', updated_at = datetime('now') WHERE id = ?"
    ).run(id);

    // Free the table
    if (order.table_id) {
      db.prepare(
        "UPDATE restaurant_tables SET status = 'available' WHERE id = ?"
      ).run(order.table_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Payment error:", error);
    return NextResponse.json(
      { error: "Failed to process payment" },
      { status: 500 }
    );
  }
}
