import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import supabase from "@/lib/supabase";
import { generateOrderNumber } from "@/lib/orders";
import { findOrCreateCustomerByPhone } from "@/lib/customers";
import { resolveItemWithModifiers } from "@/lib/modifiers";
import { validateScheduledTime } from "@/lib/scheduling";
import { isRestaurantOpen } from "@/lib/hours";
import { checkDeliveryEligibility, computeDeliveryFee, MIN_DELIVERY_ORDER } from "@/lib/delivery-zones";
import { isValidEmail, isValidUkMobile } from "@/lib/utils";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { formatTicketText } from "@/lib/cloudprnt";

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
      marketing_consent,
      notes,
      scheduled_for, // ISO string, optional — omitted/null means ASAP
      pay_online, // customer picked "Pay Online Now" — a checkout session follows this call
      items, // [{ menu_item_id, quantity, notes, selected_options }]
    } = body;

    if (order_type !== "takeaway" && order_type !== "delivery") {
      return NextResponse.json({ error: "Invalid order type" }, { status: 400 });
    }
    if (!customer_name || !customer_phone || !customer_email) {
      return NextResponse.json({ error: "Name, phone, and email are required" }, { status: 400 });
    }
    if (!isValidUkMobile(customer_phone)) {
      return NextResponse.json({ error: "Please enter a valid UK mobile number (starts with 07, 11 digits)" }, { status: 400 });
    }
    if (!isValidEmail(customer_email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
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
    } else if (!isRestaurantOpen()) {
      return NextResponse.json({ error: "We're closed right now — please schedule your order for later." }, { status: 400 });
    }

    let deliverable = false;
    if (order_type === "delivery") {
      const eligibility = await checkDeliveryEligibility(customer_postcode);
      deliverable = eligibility.deliverable;
      if (!deliverable) {
        return NextResponse.json({ error: "Sorry, we don't deliver there — we deliver within 5 miles of the restaurant" }, { status: 400 });
      }
    }

    const orderItems = await Promise.all(
      items.map(async (item: { menu_item_id: number; quantity: number; notes?: string; selected_options?: number[] }) => {
        const resolved = await resolveItemWithModifiers(item.menu_item_id, item.selected_options || [], "online");
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
    if (deliverable && subtotal < MIN_DELIVERY_ORDER) {
      return NextResponse.json(
        { error: `Minimum order for delivery is £${MIN_DELIVERY_ORDER.toFixed(2)} (currently £${subtotal.toFixed(2)})` },
        { status: 400 }
      );
    }
    const deliveryFee = deliverable ? computeDeliveryFee(subtotal) : 0;
    const total = Math.round((subtotal + deliveryFee) * 100) / 100;
    // Menu prices are VAT-inclusive — nothing is added here, `tax` is just
    // the 20% VAT component embedded in the food subtotal, reported for
    // records/VAT-return purposes (matches lib/order-totals.ts computeBill;
    // delivery fee isn't included in this figure).
    const tax = Math.round((subtotal - subtotal / 1.2) * 100) / 100;

    const { data: workPeriod } = await supabase
      .from("work_periods")
      .select("id")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .single();

    const orderNumber = await generateOrderNumber();
    const customerId = await findOrCreateCustomerByPhone(customer_phone, customer_name, customer_email, marketing_consent === true);

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
        delivery_zone_id: null, // no more named zones — eligibility is a live 5-mile radius check
        status: "sent_to_kitchen",
        scheduled_for: scheduled_for || null,
        work_period_id: workPeriod?.id || null,
        subtotal: Math.round(subtotal * 100) / 100,
        discount: 0,
        tax,
        total,
        notes: [notes, deliverable ? `Delivery fee: £${deliveryFee.toFixed(2)}` : null]
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

    // Paying online means this order isn't actually confirmed yet — a
    // checkout session follows this response, and the customer's payment
    // could still fail or be abandoned. Sending "order confirmed" now would
    // be a lie in that case; the webhook sends it once payment is real.
    if (!pay_online) {
      waitUntil(sendOrderConfirmationEmail(customer_email, {
        orderNumber,
        customerName: customer_name,
        orderType: order_type,
        scheduledFor: scheduled_for || null,
        subtotal: Math.round(subtotal * 100) / 100,
        deliveryFee,
        discount: 0,
        total,
        customerAddress:
          order_type === "delivery" ? `${customer_address}, ${customer_postcode.trim().toUpperCase()}` : null,
        paymentMethod: order_type === "delivery" ? "Cash or card on delivery" : "Cash or card on collection",
        paymentStatus: "due",
        items: orderItems.map((i) => ({ name: i.item_name, quantity: i.quantity, unitPrice: i.item_price, notes: i.notes })),
      }));
    }

    // Queues a ticket for the reception printer (Star mC-Print3, CloudPRNT)
    // so staff see the order without watching any screen — see
    // app/api/cloudprnt and lib/cloudprnt.ts.
    waitUntil(
      formatTicketText(order.id)
        .then(async (content) => {
          if (content) await supabase.from("print_jobs").insert({ order_id: order.id, content });
        })
        .catch((err) => console.error("Failed to queue reception print job:", err))
    );

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
