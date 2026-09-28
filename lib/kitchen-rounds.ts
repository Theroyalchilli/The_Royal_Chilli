import supabase from "@/lib/supabase";
import { tradingDayStr, tradingRangeUtc } from "@/lib/london-date";

// Round numbers for dine-in tables. Every till "Send to Kitchen" is its own
// order row, so a table's visit is its orders that aren't paid or cancelled
// yet (this trading day): the first ticket is Round 1, the next Round 2, and
// so on. Once the table pays, the next guests start again at Round 1. Shared
// by the Kitchen Display and the printed kitchen ticket so they always agree.

type VisitOrder = { id: number; table_id: number | null; created_at: string };

// Pure: round number per order id, from a table's open orders in any order.
export function roundNumbers(orders: VisitOrder[]): Map<number, number> {
  const byTable = new Map<number, VisitOrder[]>();
  for (const o of orders) {
    if (o.table_id == null) continue;
    const list = byTable.get(o.table_id) ?? [];
    list.push(o);
    byTable.set(o.table_id, list);
  }
  const rounds = new Map<number, number>();
  for (const list of byTable.values()) {
    list
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
      .forEach((o, i) => rounds.set(o.id, i + 1));
  }
  return rounds;
}

// The open (unpaid, not cancelled) orders of these tables this trading day.
export async function openTableOrders(tableIds: number[]): Promise<VisitOrder[]> {
  if (tableIds.length === 0) return [];
  const { start } = tradingRangeUtc(tradingDayStr());
  const { data } = await supabase
    .from("orders")
    .select("id, table_id, created_at")
    .in("table_id", tableIds)
    .not("status", "in", '("paid","cancelled")')
    .gte("created_at", start);
  return (data ?? []) as VisitOrder[];
}

// One order's round number (null for takeaway/delivery or if not found).
export async function roundNumberFor(order: { id: number; table_id: number | null }): Promise<number | null> {
  if (order.table_id == null) return null;
  const rounds = roundNumbers(await openTableOrders([order.table_id]));
  return rounds.get(order.id) ?? null;
}
