import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

    const db = getDb();

    // Summary stats
    const summary = db
      .prepare(`
        SELECT
          COUNT(*) as total_orders,
          COALESCE(SUM(total), 0) as total_revenue,
          COALESCE(AVG(total), 0) as avg_order_value,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) as paid_orders
        FROM orders
        WHERE date(created_at) = ? AND status NOT IN ('cancelled')
      `)
      .get(date) as {
        total_orders: number;
        total_revenue: number;
        avg_order_value: number;
        paid_orders: number;
      };

    // By order type
    const byType = db
      .prepare(`
        SELECT
          order_type,
          COUNT(*) as count,
          COALESCE(SUM(total), 0) as revenue
        FROM orders
        WHERE date(created_at) = ? AND status NOT IN ('cancelled')
        GROUP BY order_type
      `)
      .all(date);

    // Top items
    const topItems = db
      .prepare(`
        SELECT
          oi.item_name,
          SUM(oi.quantity) as quantity_sold,
          SUM(oi.item_price * oi.quantity) as revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE date(o.created_at) = ? AND o.status NOT IN ('cancelled')
        GROUP BY oi.item_name
        ORDER BY quantity_sold DESC
        LIMIT 10
      `)
      .all(date);

    // Payment split
    const paymentSplit = db
      .prepare(`
        SELECT method, COUNT(*) as count, SUM(amount) as total
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        WHERE date(p.created_at) = ?
        GROUP BY method
      `)
      .all(date);

    // Hourly breakdown
    const hourly = db
      .prepare(`
        SELECT
          strftime('%H', created_at) as hour,
          COUNT(*) as orders,
          COALESCE(SUM(total), 0) as revenue
        FROM orders
        WHERE date(created_at) = ? AND status NOT IN ('cancelled')
        GROUP BY hour
        ORDER BY hour
      `)
      .all(date);

    return NextResponse.json({
      date,
      summary,
      byType,
      topItems,
      paymentSplit,
      hourly,
    });
  } catch (error) {
    console.error("Reports error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
