import { tradingDayStr, tradingRangeUtc } from "@/lib/london-date";

// Dishes marked "sold out" at the till (menu_items.sold_out_until) stay off
// the website and table-QR menus until the next trading day starts (5am UK).
// Safe to import in the browser.

export function soldOutUntilTomorrow(now: Date = new Date()): string {
  return new Date(new Date(tradingRangeUtc(tradingDayStr(now)).end).getTime() + 1).toISOString();
}

export function isSoldOut(item: { sold_out_until?: string | null }, now: Date = new Date()): boolean {
  return !!item.sold_out_until && new Date(item.sold_out_until).getTime() > now.getTime();
}
