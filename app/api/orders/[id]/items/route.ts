import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
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

    const { data: items, error } = await supabase
      .from("order_items")
      .select(`
        *,
        menu_items(is_veg)
      `)
      .eq("order_id", id)
      .order("created_at");

    if (error) throw error;

    // Flatten is_veg from joined menu_items
    const flatItems = (items ?? []).map((item) => {
      const { menu_items: mi, ...rest } = item as typeof item & {
        menu_items: { is_veg: number } | null;
      };
      return {
        ...rest,
        is_veg: mi?.is_veg ?? 0,
      };
    });

    return NextResponse.json({ items: flatItems });
  } catch (error) {
    console.error("Order items fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { items } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const { data: order, error: orderFetchError } = await supabase
      .from("orders")
      .select("id")
      .eq("id", id)
      .single();

    if (orderFetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const itemRows = items.map((item: {
      menu_item_id?: number;
      item_name: string;
      item_price: number;
      quantity: number;
      notes?: string;
    }) => ({
      order_id: Number(id),
      menu_item_id: item.menu_item_id || null,
      item_name: item.item_name,
      item_price: item.item_price,
      quantity: item.quantity,
      original_quantity: item.quantity,
      notes: item.notes || null,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("order_items")
      .insert(itemRows)
      .select("id");

    if (insertError) throw insertError;

    const insertedIds = (inserted ?? []).map((r: { id: number }) => r.id);

    // Recalculate order totals from all active items
    await recalcTotals(id);

    return NextResponse.json({ success: true, insertedIds });
  } catch (error) {
    console.error("Add items error:", error);
    return NextResponse.json({ error: "Failed to add items" }, { status: 500 });
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

    const { id: orderId } = await params;
    const { itemId, status, action, quantity } = await req.json();

    if (action === "void") {
      const { error } = await supabase
        .from("order_items")
        .update({ status: "cancelled" })
        .eq("id", itemId)
        .eq("order_id", orderId);

      if (error) throw error;
      await recalcTotals(orderId);
    } else if (action === "reduce" && quantity > 0) {
      const { error } = await supabase
        .from("order_items")
        .update({ quantity })
        .eq("id", itemId)
        .eq("order_id", orderId);

      if (error) throw error;
      await recalcTotals(orderId);
    } else if (status) {
      const { error } = await supabase
        .from("order_items")
        .update({ status })
        .eq("id", itemId)
        .eq("order_id", orderId);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Order item update error:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

