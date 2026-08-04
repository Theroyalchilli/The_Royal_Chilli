import { NextRequest, NextResponse } from "next/server";
import { getTableByNumber, getOpenOrderForTable, getOrderItems } from "@/lib/dine-in";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tableNumber: string }> }
) {
  const { tableNumber } = await params;
  const table = await getTableByNumber(tableNumber);
  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  const order = await getOpenOrderForTable(table.id);
  const items = order ? await getOrderItems(order.id) : [];

  return NextResponse.json({
    table,
    order: order ? { id: order.id, order_number: order.order_number, status: order.status, total: order.total } : null,
    items,
  });
}
