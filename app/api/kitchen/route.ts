import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(`
        *,
        restaurant_tables(table_number),
        staff:staff!orders_staff_id_fkey(name)
      `)
      .in("status", ["sent_to_kitchen", "ready"])
      .order("created_at", { ascending: true });

    if (ordersError) throw ordersError;

    // Fetch items for each order
    const orderIds = (orders ?? []).map((o: { id: number }) => o.id);

    let itemsByOrder: Record<number, unknown[]> = {};
    if (orderIds.length > 0) {
      const { data: allItems, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds)
        .order("created_at");

      if (itemsError) throw itemsError;

      const itemIds = (allItems ?? []).map((i) => (i as { id: number }).id);
      const { data: allModifiers } = itemIds.length > 0
        ? await supabase.from("order_item_modifiers").select("order_item_id, option_name").in("order_item_id", itemIds)
        : { data: [] };
      const modifiersByItem = new Map<number, string[]>();
      for (const m of allModifiers ?? []) {
        const list = modifiersByItem.get(m.order_item_id) || [];
        list.push(m.option_name);
        modifiersByItem.set(m.order_item_id, list);
      }

      for (const item of allItems ?? []) {
        const oi = item as { id: number; order_id: number };
        if (!itemsByOrder[oi.order_id]) itemsByOrder[oi.order_id] = [];
        itemsByOrder[oi.order_id].push({ ...item, modifiers: modifiersByItem.get(oi.id) || [] });
      }
    }

    const ordersWithItems = (orders ?? []).map((o) => {
      const { restaurant_tables: rt, staff: s, ...rest } = o as typeof o & {
        restaurant_tables: { table_number: string } | null;
        staff: { name: string } | null;
      };
      return {
        ...rest,
        table_number: rt?.table_number ?? null,
        staff_name: s?.name ?? null,
        items: itemsByOrder[(o as { id: number }).id] ?? [],
      };
    });

    return NextResponse.json({ orders: ordersWithItems });
  } catch (error) {
    console.error("Kitchen fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch kitchen orders" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId, status } = await req.json();

    const { error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orderId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Kitchen update error:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}
