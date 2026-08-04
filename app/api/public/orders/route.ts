import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { generateOrderNumber } from "@/lib/orders";
import { findOrCreateCustomerByPhone } from "@/lib/customers";
import { resolveItemWithModifiers } from "@/lib/modifiers";
import { validateScheduledTime } from "@/lib/scheduling";
import { matchDeliveryZone } from "@/lib/delivery-zones";
import { sendOrderConfirmationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      order_type, // 'takeaway' | 'delivery'
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      customer_postcode,
      notes,
      scheduled_for, // ISO string, optional — omitted/null means ASAP
      items, // [{ menu_item_id, quantity, notes, selected_options }]
    } = body;

    if (order_type !== "takeaway" && order_type !== "delivery") {
      return NextResponse.json({ error: "Invalid order type" }, { status: 400 });
    }
    if (!customer_name || !customer_phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
    }
    if (order_type === "delivery" && (!customer_address || !customer_postcode)) {
      return NextResponse.json({ error: "Delivery address and postcode are required" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }
    if (scheduled_for) {
      const scheduleError = validateScheduledTime(scheduled_for);
      if (scheduleError) return NextResponse.json({ error: scheduleError }, { status: 400 });
    }

    let zone = null;
    if (order_type === "delivery") {
      zone = await matchDeliveryZone(customer_postcode);
      if (!zone) {
        return NextResponse.json({ error: "Sorry, we don't currently deliver to that postcode" }, { status: 400 });
      }
    }

    const orderItems = await Promise.all(
      items.map(async (item: { menu_item_id: number; quantity: number; notes?: string; selected_options?: number[] }) => {
        const resolved = await resolveItemWithModifiers(item.menu_item_id, item.selected_options || []);
        const quantity = Math.max(1, Number(item.quantity) || 1);
        return {
          menu_item_id: resolved.menuItemId,
          item_name: resolved.itemName,
          item_price: resolved.unitPrice,
          quantity,
          original_quantity: quantity,
          notes: item.notes || null,
          status: "pending" as const,
          _modifiers: resolved.selectedModifiers,
        };
      })
    );

    const subtotal = orderItems.reduce((sum, i) => sum + i.item_price * i.quantity, 0);
    if (zone && subtotal < zone.min_order) {
      return NextResponse.json(
        { error: `Minimum order for delivery to this area is £${zone.min_order.toFixed(2)} (currently £${subtotal.toFixed(2)})` },
        { status: 400 }
      );
    }
    const deliveryFee = zone ? zone.fee : 0;
    const total = Math.round((subtotal + deliveryFee) * 100) / 100;

    const { data: workPeriod } = await supabase
      .from("work_periods")
      .select("id")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .single();

    const orderNumber = await generateOrderNumber();
    const customerId = await findOrCreateCustomerByPhone(customer_phone, customer_name, customer_email);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        order_type,
        customer_id: customerId,
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        customer_address: order_type === "delivery" ? customer_address : null,
        customer_postcode: order_type === "delivery" ? customer_postcode.trim().toUpperCase() : null,
        delivery_zone_id: zone?.id ?? null,
        status: "sent_to_kitchen",
        scheduled_for: scheduled_for || null,
        work_period_id: workPeriod?.id || null,
        subtotal: Math.round(subtotal * 100) / 100,
        discount: 0,
        tax: 0,
        total,
        notes: [notes, zone ? `Delivery fee: £${deliveryFee.toFixed(2)} (${zone.name})` : null]
          .filter(Boolean)
          .join("\n") || null,
      })
      .select()
      .single();
    if (orderErr) throw orderErr;

    for (const item of orderItems) {
      const { _modifiers, ...itemRow } = item;
      const { data: insertedItem, error: itemErr } = await supabase
        .from("order_items")
        .insert({ ...itemRow, order_id: order.id })
        .select("id")
        .single();
      if (itemErr) throw itemErr;

      if (_modifiers.length > 0) {
        const { error: modErr } = await supabase.from("order_item_modifiers").insert(
          _modifiers.map((m) => ({ order_item_id: insertedItem.id, modifier_option_id: m.id, option_name: m.name, price_delta: m.price_delta }))
        );
        if (modErr) throw modErr;
      }
    }

    sendOrderConfirmationEmail(customer_email, {
      orderNumber,
      orderType: order_type,
      total,
      scheduledFor: scheduled_for || null,
      items: orderItems.map((i) => ({ name: i.item_name, quantity: i.quantity })),
    });

    return NextResponse.json(
      { success: true, id: order.id, order_number: orderNumber, total, scheduled_for: scheduled_for || null },
      { status: 201 }
    );
  } catch (error) {
    console.error("Public order create error:", error);
    const message = error instanceof Error ? error.message : "Failed to place order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
