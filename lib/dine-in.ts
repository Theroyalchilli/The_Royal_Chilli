import supabase from "@/lib/supabase";
import { generateOrderNumber } from "@/lib/orders";
import { resolveItemWithModifiers } from "@/lib/modifiers";

const OPEN_STATUSES = ["open", "sent_to_kitchen", "ready"];

export async function getTableByNumber(tableNumber: string) {
  const { data } = await supabase
    .from("restaurant_tables")
    .select("id, table_number, capacity, status")
    .eq("table_number", tableNumber)
    .maybeSingle();
  return data;
}

export async function getOpenOrderForTable(tableId: number) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("table_id", tableId)
    .eq("order_type", "dine_in")
    .in("status", OPEN_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getOrderItems(orderId: number) {
  const { data, error } = await supabase
    .from("order_items")
    .select("id, item_name, item_price, quantity, status, notes")
    .eq("order_id", orderId)
    .order("created_at");
  if (error) throw error;

  const itemIds = (data || []).map((i) => i.id);
  if (itemIds.length === 0) return data || [];
  const { data: modifiers } = await supabase
    .from("order_item_modifiers")
    .select("order_item_id, option_name, price_delta")
    .in("order_item_id", itemIds);
  const modsByItem = new Map<number, { option_name: string; price_delta: number }[]>();
  for (const m of modifiers || []) {
    const list = modsByItem.get(m.order_item_id) || [];
    list.push({ option_name: m.option_name, price_delta: Number(m.price_delta) });
    modsByItem.set(m.order_item_id, list);
  }
  return (data || []).map((i) => ({ ...i, modifiers: modsByItem.get(i.id) || [] }));
}

async function recalcOrderTotal(orderId: number) {
  const { data: items } = await supabase
    .from("order_items")
    .select("item_price, quantity")
    .eq("order_id", orderId)
    .neq("status", "cancelled");
  const total = Math.round(
    (items || []).reduce((s, i) => s + i.item_price * i.quantity, 0) * 100
  ) / 100;
  // Dine-in menu prices are VAT-inclusive, so no tax is added on top here.
  await supabase
    .from("orders")
    .update({ subtotal: total, total, tax: 0, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  return total;
}

export async function addItemsToTable(
  tableId: number,
  rawItems: { menu_item_id: number; quantity: number; notes?: string; selected_options?: number[] }[]
) {
  const itemRows = await Promise.all(
    rawItems.map(async (item) => {
      const resolved = await resolveItemWithModifiers(item.menu_item_id, item.selected_options || [], "pos");
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

  let order = await getOpenOrderForTable(tableId);
  if (!order) {
    const orderNumber = await generateOrderNumber();
    const { data: newOrder, error: orderErr } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        order_type: "dine_in",
        table_id: tableId,
        status: "sent_to_kitchen",
        subtotal: 0,
        discount: 0,
        tax: 0,
        total: 0,
      })
      .select()
      .single();
    if (orderErr) throw orderErr;
    order = newOrder;
    await supabase.from("restaurant_tables").update({ status: "occupied" }).eq("id", tableId);
  } else if (order.status === "ready") {
    // A new round arrived after the previous round was marked ready — back to the kitchen queue.
    await supabase.from("orders").update({ status: "sent_to_kitchen" }).eq("id", order.id);
  }

  for (const item of itemRows) {
    const { _modifiers, ...itemRow } = item;
    const { data: insertedItem, error: itemErr } = await supabase
      .from("order_items")
      .insert({ ...itemRow, order_id: order!.id })
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

  await recalcOrderTotal(order!.id);
  return order!.id;
}
