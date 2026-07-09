import { NextRequest, NextResponse } from "next/server";
import getDb, { generateOrderNumber } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const date = searchParams.get("date");
    const tableId = searchParams.get("table_id");

    const db = getDb();
    let query = `
      SELECT o.*, rt.table_number, s.name as staff_name
      FROM orders o
      LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (status === "open") {
      // "open" means any unpaid, active order
      query += ` AND o.status NOT IN ('paid', 'cancelled')`;
    } else if (status) {
      query += ` AND o.status = ?`;
      params.push(status);
    }
    if (tableId) {
      query += ` AND o.table_id = ?`;
      params.push(Number(tableId));
    }
    if (date) {
      query += ` AND date(o.created_at) = ?`;
      params.push(date);
    }

    query += ` ORDER BY o.created_at DESC`;

    const orders = db.prepare(query).all(...params);
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Orders fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      order_type,
      table_id,
      customer_name,
      customer_phone,
      customer_address,
      items,
      notes,
      discount,
      discount_reason,
    } = body;

    if (!order_type || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Order type and items required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const orderNumber = generateOrderNumber();

    // Get open work period
    const workPeriod = db
      .prepare("SELECT id FROM work_periods WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1")
      .get() as { id: number } | undefined;

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: { item_price: number; quantity: number }) =>
        sum + item.item_price * item.quantity,
      0
    );
    const discountAmt = discount || 0;
    const taxableAmount = subtotal - discountAmt;
    const tax = Math.round(taxableAmount * 0.2 * 100) / 100; // 20% VAT
    const total = Math.round((taxableAmount + tax) * 100) / 100;

    const insertOrder = db.prepare(`
      INSERT INTO orders (
        order_number, order_type, table_id, customer_name, customer_phone,
        customer_address, staff_id, work_period_id, subtotal, discount,
        discount_reason, tax, total, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
    `);

    const result = insertOrder.run(
      orderNumber,
      order_type,
      table_id || null,
      customer_name || null,
      customer_phone || null,
      customer_address || null,
      session.id,
      workPeriod?.id || null,
      subtotal,
      discountAmt,
      discount_reason || null,
      tax,
      total,
      notes || null
    );

    const orderId = result.lastInsertRowid;

    // Insert order items
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, menu_item_id, item_name, item_price, quantity, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertItem.run(
        orderId,
        item.menu_item_id || null,
        item.item_name,
        item.item_price,
        item.quantity,
        item.notes || null
      );
    }

    // Update table status if dine-in
    if (order_type === "dine_in" && table_id) {
      db.prepare("UPDATE restaurant_tables SET status = 'occupied' WHERE id = ?").run(table_id);
    }

    const order = db
      .prepare(`
        SELECT o.*, rt.table_number, s.name as staff_name
        FROM orders o
        LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
        LEFT JOIN staff s ON o.staff_id = s.id
        WHERE o.id = ?
      `)
      .get(orderId);

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error) {
    console.error("Order create error:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
