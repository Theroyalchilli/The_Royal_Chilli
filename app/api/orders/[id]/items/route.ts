import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { recalcTotals } from "@/lib/order-totals";
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

      // Voiding the last active item leaves an order with nothing left to
      // send or pay for — close it out the same way an explicit whole-order
      // cancel does, so a dine-in table doesn't stay stuck "occupied" with
      // an empty order (see cancelOrderAndFreeTable's docstring).
      const { count: remaining } = await supabase
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("order_id", orderId)
        .neq("status", "cancelled");
      if (remaining === 0) {
        const { data: order } = await supabase.from("orders").select("table_id").eq("id", orderId).single();
        await cancelOrderAndFreeTable(Number(orderId), order?.table_id ?? null);
      }
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

      // Item-level "bump": once the last pending item on a ticket is
      // bumped, the whole order auto-completes — kitchen doesn't need a
      // separate "mark order ready" tap on top of bumping every item.
      if (status === "ready") {
        const { count: stillPending } = await supabase
          .from("order_items")
          .select("id", { count: "exact", head: true })
          .eq("order_id", orderId)
          .eq("status", "pending");
        if (stillPending === 0) {
          await supabase
            .from("orders")
            .update({ status: "ready", updated_at: new Date().toISOString() })
            .eq("id", orderId)
            .eq("status", "sent_to_kitchen");
        }
      } else if (status === "pending") {
        // Un-bumping an item on an order that had already auto-completed
        // reopens the order — it's no longer actually fully ready.
        await supabase
          .from("orders")
          .update({ status: "sent_to_kitchen", updated_at: new Date().toISOString() })
          .eq("id", orderId)
          .eq("status", "ready");
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Order item update error:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

