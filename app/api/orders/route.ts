import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { generateOrderNumber } from "@/lib/orders";
import { findOrCreateCustomerByPhone } from "@/lib/customers";
import { computeBill } from "@/lib/order-totals";

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
    const orderType = searchParams.get("order_type");
    const source = searchParams.get("source"); // 'website' = customer self-service (takeaway/delivery), not a staff-created POS order

    let query = supabase
      .from("orders")
      .select(`
        *,
        restaurant_tables(table_number),
        staff:staff!orders_staff_id_fkey(name)
      `)
      .order("created_at", { ascending: false });

    if (status === "open") {
      // "open" means any unpaid, active order
      query = query.not("status", "in", '("paid","cancelled")');
    } else if (status) {
      query = query.eq("status", status);
    }

    if (orderType) {
      query = query.eq("order_type", orderType);
    }

    if (source === "website") {
      // Website orders never have a staff_id — only staff-created POS orders do.
      query = query.is("staff_id", null).in("order_type", ["takeaway", "delivery"]);
    }

    if (tableId) {
      query = query.eq("table_id", Number(tableId));
    }

    if (date) {
      const dayStart = date + "T00:00:00.000Z";
      const dayEnd = date + "T23:59:59.999Z";
      query = query.gte("created_at", dayStart).lte("created_at", dayEnd);
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    // Flatten joined fields to match original shape
    let flatOrders = (orders ?? []).map((o) => {
      const { restaurant_tables: rt, staff: s, ...rest } = o as typeof o & {
        restaurant_tables: { table_number: string } | null;
        staff: { name: string } | null;
      };
      return {
        ...rest,
        table_number: rt?.table_number ?? null,
        staff_name: s?.name ?? null,
      };
    });

    if (source === "website") {
      // A stripe_session_id means the customer chose to pay online — don't
      // surface it to staff (who'd otherwise start cooking) until the
      // webhook actually confirms payment. An order with no session (paid
      // at collection/delivery) still shows immediately as normal.
      flatOrders = flatOrders.filter(
        (o) => !o.stripe_session_id || Number(o.amount_paid) >= Number(o.total)
      );
    }

    return NextResponse.json({ orders: flatOrders });
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

    if (order_type === "delivery" && !String(customer_address || "").trim()) {
      return NextResponse.json(
        { error: "A delivery address is required" },
        { status: 400 }
      );
    }

    // Get open work period
    const { data: workPeriod } = await supabase
      .from("work_periods")
      .select("id")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .single();

    // Calculate totals — subtotal -> VAT -> discount -> total (see lib/order-totals.ts).
    // New orders never start with a service charge; that's applied later via
    // PUT /api/orders/:id/service-charge if needed.
    const subtotal = items.reduce(
      (sum: number, item: { item_price: number; quantity: number }) =>
        sum + item.item_price * item.quantity,
      0
    );
    const discountAmt = discount || 0;
    const bill = computeBill({
      subtotal,
      discountType: discountAmt > 0 ? "amount" : null,
      discountPct: null,
      discountAmount: discountAmt,
      serviceChargePct: 0,
    });
    const { tax, total } = bill;

    const orderNumber = await generateOrderNumber();
    const customerId = customer_phone ? await findOrCreateCustomerByPhone(customer_phone, customer_name || "Guest") : null;

    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        order_type,
        table_id: table_id || null,
        customer_id: customerId,
        customer_name: customer_name || null,
        customer_phone: customer_phone || null,
        customer_address: customer_address || null,
        staff_id: session.id,
        work_period_id: workPeriod?.id || null,
        subtotal,
        discount: discountAmt,
        discount_type: discountAmt > 0 ? "amount" : null,
        discount_reason: discount_reason || null,
        tax,
        total,
        notes: notes || null,
        status: "open",
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderId = newOrder.id;

    // Insert order items
    type IncomingItem = {
      menu_item_id?: number;
      item_name: string;
      item_price: number;
      quantity: number;
      notes?: string;
      selected_modifiers?: { id: number; name: string; price_delta: number }[];
    };
    const typedItems = items as IncomingItem[];
    const itemRows = typedItems.map((item) => ({
      order_id: orderId,
      menu_item_id: item.menu_item_id || null,
      item_name: item.item_name,
      item_price: item.item_price,
      quantity: item.quantity,
      original_quantity: item.quantity,
      notes: item.notes || null,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from("order_items")
      .insert(itemRows)
      .select("id, menu_item_id");

    if (itemsError) throw itemsError;

    const modifierRows = (insertedItems || []).flatMap((row, idx) =>
      (typedItems[idx].selected_modifiers || []).map((m) => ({
        order_item_id: row.id,
        modifier_option_id: m.id,
        option_name: m.name,
        price_delta: m.price_delta,
      }))
    );
    if (modifierRows.length > 0) {
      const { error: modErr } = await supabase.from("order_item_modifiers").insert(modifierRows);
      if (modErr) throw modErr;
    }

    // Update table status if dine-in
    if (order_type === "dine_in" && table_id) {
      await supabase
        .from("restaurant_tables")
        .update({ status: "occupied" })
        .eq("id", table_id);
    }

    // Fetch full order with joins
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select(`
        *,
        restaurant_tables(table_number),
        staff:staff!orders_staff_id_fkey(name)
      `)
      .eq("id", orderId)
      .single();

    if (fetchError) throw fetchError;

    const { restaurant_tables: rt, staff: s, ...orderRest } = order as typeof order & {
      restaurant_tables: { table_number: string } | null;
      staff: { name: string } | null;
    };

    return NextResponse.json(
      {
        success: true,
        order: { ...orderRest, table_number: rt?.table_number ?? null, staff_name: s?.name ?? null },
        items: insertedItems,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Order create error:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
