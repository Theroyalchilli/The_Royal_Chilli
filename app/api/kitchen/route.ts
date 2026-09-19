import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: rawOrders, error: ordersError } = await supabase
      .from("orders")
      .select(`
        *,
        restaurant_tables(table_number),
        staff:staff!orders_staff_id_fkey(name)
      `)
      .in("status", ["sent_to_kitchen", "ready"])
      .order("created_at", { ascending: true });

    if (ordersError) throw ordersError;

    // A scheduled order (e.g. placed tonight for tomorrow's opening) sits in
    // "sent_to_kitchen" from the moment it's placed, same as an ASAP order —
    // without this, it shows up on the board hours or days early and is
    // still sitting there, indistinguishable from a live ticket, whenever
    // staff next open the screen. Reveal it once it's within normal prep
    // time of its slot: matches the ETA windows already quoted to customers
    // in the order-confirmation email (lib/email.ts) — ~20-30 min for
    // takeaway, ~45-60 min for delivery (extra time for the drive).
    const KITCHEN_LEAD_MINUTES: Record<string, number> = { takeaway: 30, delivery: 45 };
    const now = Date.now();
    const orders = (rawOrders ?? []).filter((o) => {
      if (!o.scheduled_for) return true;
      const leadMinutes = KITCHEN_LEAD_MINUTES[o.order_type] ?? 30;
      return new Date(o.scheduled_for).getTime() - now <= leadMinutes * 60_000;
    });

    // Orders cancelled in the last 2 minutes: kitchen needs a brief, explicit
    // "stop prep" alert instead of the ticket silently vanishing next poll.
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: justCancelled } = await supabase
      .from("orders")
      .select(`
        *,
        restaurant_tables(table_number),
        staff:staff!orders_staff_id_fkey(name)
      `)
      .eq("status", "cancelled")
      .gte("updated_at", twoMinAgo);

    // "Modified" ticket: this table already had an earlier order today, so
    // this ticket represents items added mid-visit, not a fresh table.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: todaysTableOrders } = await supabase
      .from("orders")
      .select("table_id, created_at")
      .not("table_id", "is", null)
      .neq("status", "cancelled")
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: true });

    const firstOrderTimeByTable = new Map<number, string>();
    for (const o of todaysTableOrders || []) {
      if (o.table_id != null && !firstOrderTimeByTable.has(o.table_id)) {
        firstOrderTimeByTable.set(o.table_id, o.created_at);
      }
    }

    // Fetch items for each order (active + just-cancelled, so the cancelled
    // alert card can still show what was in it)
    const allOrderRows = [...(orders ?? []), ...(justCancelled ?? [])];
    const orderIds = allOrderRows.map((o: { id: number }) => o.id);

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
        id: number;
        table_id: number | null;
        created_at: string;
      };
      const firstOrderTime = rest.table_id != null ? firstOrderTimeByTable.get(rest.table_id) : undefined;
      return {
        ...rest,
        table_number: rt?.table_number ?? null,
        staff_name: s?.name ?? null,
        items: itemsByOrder[rest.id] ?? [],
        is_modification: !!firstOrderTime && new Date(rest.created_at) > new Date(firstOrderTime),
        just_cancelled: false,
      };
    });

    const cancelledAlerts = (justCancelled ?? []).map((o) => {
      const { restaurant_tables: rt, staff: s, ...rest } = o as typeof o & {
        restaurant_tables: { table_number: string } | null;
        staff: { name: string } | null;
        id: number;
      };
      return {
        ...rest,
        table_number: rt?.table_number ?? null,
        staff_name: s?.name ?? null,
        items: itemsByOrder[rest.id] ?? [],
        is_modification: false,
        just_cancelled: true,
      };
    });

    return NextResponse.json({ orders: [...cancelledAlerts, ...ordersWithItems] });
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

    // Cascade to items so per-item bump state (used by the Active board)
    // stays consistent with a whole-order action:
    //  - "Bump All" (status -> ready) bumps every item still pending
    //  - "Recall" (status -> sent_to_kitchen) undoes the whole bump event,
    //    since there's no reliable way to tell which items were genuinely
    //    finished vs. swept up by "Bump All".
    if (status === "ready") {
      await supabase.from("order_items").update({ status: "ready" }).eq("order_id", orderId).eq("status", "pending");
    } else if (status === "sent_to_kitchen") {
      await supabase.from("order_items").update({ status: "pending" }).eq("order_id", orderId).eq("status", "ready");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Kitchen update error:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}
