import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { cancelOrderAndFreeTable } from "@/lib/orders";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        restaurant_tables(table_number),
        staff:staff!orders_staff_id_fkey(name)
      `)
      .eq("id", id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { restaurant_tables: rt, staff: s, ...orderRest } = order as typeof order & {
      restaurant_tables: { table_number: string } | null;
      staff: { name: string } | null;
    };

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id)
      .order("created_at");

    if (itemsError) throw itemsError;

    return NextResponse.json({
      order: { ...orderRest, table_number: rt?.table_number ?? null, staff_name: s?.name ?? null },
      items,
    });
  } catch (error) {
    console.error("Order fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, discount, discount_reason, notes } = body;

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, table_id, status, subtotal")
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (status === "cancelled") {
      await cancelOrderAndFreeTable(Number(id), order.table_id);
    } else if (status) {
      const { error } = await supabase
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      // Free table when the order is fully paid this way (rare — normal
      // payments go through /payment, which handles this itself).
      if (status === "paid" && order.table_id) {
        await supabase
          .from("restaurant_tables")
          .update({ status: "available" })
          .eq("id", order.table_id);
      }
    }

    if (discount !== undefined) {
      const existingSubtotal = (order as { subtotal: number }).subtotal;
      const taxableAmount = existingSubtotal - discount;
      const tax = Math.round(taxableAmount * 0.2 * 100) / 100;
      const total = Math.round((taxableAmount + tax) * 100) / 100;

      const updatePayload: Record<string, unknown> = {
        discount,
        discount_reason: discount_reason || null,
        tax,
        total,
        updated_at: new Date().toISOString(),
      };
      if (notes) updatePayload.notes = notes;

      const { error } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", id);

      if (error) throw error;
    }

    const { data: updated, error: updError } = await supabase
      .from("orders")
      .select(`
        *,
        restaurant_tables(table_number),
        staff:staff!orders_staff_id_fkey(name)
      `)
      .eq("id", id)
      .single();

    if (updError) throw updError;

    const { restaurant_tables: rt, staff: s, ...orderRest } = updated as typeof updated & {
      restaurant_tables: { table_number: string } | null;
      staff: { name: string } | null;
    };

    return NextResponse.json({
      success: true,
      order: { ...orderRest, table_number: rt?.table_number ?? null, staff_name: s?.name ?? null },
    });
  } catch (error) {
    console.error("Order update error:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, table_id")
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    await cancelOrderAndFreeTable(Number(id), order.table_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Order delete error:", error);
    return NextResponse.json(
      { error: "Failed to cancel order" },
      { status: 500 }
    );
  }
}
