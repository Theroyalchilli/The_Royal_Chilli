import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { cancelOrderAndFreeTable } from "@/lib/orders";
import { recalcTotals } from "@/lib/order-totals";

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
    const { status, discount_type, discount_value, discount_reason, notes } = body;

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, table_id, status")
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

    if (discount_type !== undefined) {
      // Discount/service-charge changes are refused once the bill is fully
      // settled — otherwise it silently rewrites a total that's already
      // been paid and reported on.
      if (order.status === "paid") {
        return NextResponse.json({ error: "Cannot change the discount on an order that's already fully paid" }, { status: 409 });
      }

      if (discount_type === null) {
        const { error } = await supabase
          .from("orders")
          .update({ discount_type: null, discount_pct: null, discount: 0, discount_reason: null, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else if (discount_type === "percent") {
        if (typeof discount_value !== "number" || discount_value <= 0 || discount_value > 100) {
          return NextResponse.json({ error: "discount_value must be between 0 and 100 for a percent discount" }, { status: 400 });
        }
        const { error } = await supabase
          .from("orders")
          .update({ discount_type: "percent", discount_pct: discount_value, discount_reason: discount_reason || null, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else if (discount_type === "amount") {
        if (typeof discount_value !== "number" || discount_value < 0) {
          return NextResponse.json({ error: "discount_value must be a positive amount" }, { status: 400 });
        }
        const { error } = await supabase
          .from("orders")
          .update({ discount_type: "amount", discount_pct: null, discount: discount_value, discount_reason: discount_reason || null, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        return NextResponse.json({ error: "discount_type must be \"percent\", \"amount\", or null" }, { status: 400 });
      }

      await recalcTotals(id);
    }

    if (notes !== undefined) {
      const { error } = await supabase.from("orders").update({ notes, updated_at: new Date().toISOString() }).eq("id", id);
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
