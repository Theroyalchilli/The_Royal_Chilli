import { NextRequest, NextResponse } from "next/server";
import { getTableByNumber, addItemsToTable, getOpenOrderForTable, getOrderItems } from "@/lib/dine-in";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tableNumber: string }> }
) {
  try {
    const { tableNumber } = await params;
    const table = await getTableByNumber(tableNumber);
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const { items } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const orderId = await addItemsToTable(table.id, items);
    const order = await getOpenOrderForTable(table.id);
    const orderItems = await getOrderItems(orderId);

    return NextResponse.json({
      success: true,
      order: order ? { id: order.id, order_number: order.order_number, status: order.status, total: order.total } : null,
      items: orderItems,
    });
  } catch (error) {
    console.error("Dine-in order error:", error);
    const message = error instanceof Error ? error.message : "Failed to send order to kitchen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
