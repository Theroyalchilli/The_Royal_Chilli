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
    // Public + keyed only on a guessable table number — without this gate,
    // anyone off-premises could push orders straight to the kitchen for any
    // table. Staff must explicitly open a table for self-service first.
    if (!table.self_order_enabled) {
      return NextResponse.json(
        { error: "Self-ordering isn't open for this table yet — please ask a member of staff." },
        { status: 403 }
      );
    }

    const { items, customer_phone, customer_name, customer_email, marketing_consent } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const orderId = await addItemsToTable(table.id, items, {
      phone: customer_phone,
      name: customer_name,
      email: customer_email,
      marketingConsent: marketing_consent === true,
    });
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
