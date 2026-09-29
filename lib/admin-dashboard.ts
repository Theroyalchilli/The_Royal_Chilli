import supabase from "@/lib/supabase";
import { tradingDayStr, tradingRangeUtc } from "@/lib/london-date";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { getIngredientPurchases, getLabourCost, getOtherExpenses, getVatRate } from "@/lib/finance";

// Admin dashboard figures (Staff Hub home, admin only). Revenue = our own paid
// orders (till, QR, website) after discounts and refunds, VAT included, plus
// the delivery platforms' gross sales typed in daily (platform_sales). Weeks
// run Monday–Sunday; days are trading days (5am–5am UK).


// Card fees aren't itemised anywhere we can read, so estimate them from the
// card takings at a typical blended rate (SumUp ~1.69%, Stripe 1.5% + 20p).
export const CARD_FEE_RATE = 0.0175;

export const RANGES = {
  today: "Today",
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
  last_month: "Last month",
} as const;
export type RangeKey = keyof typeof RANGES;

export type Channel = { key: string; label: string; platform: boolean; revenue: number; orders: number };
export type PlatformRow = { key: PlatformKey; label: string; orders: number; sales: number; commission: number; keep: number };

export type AdminDashboard = {
  today: string;
  todayRevenue: number;
  todayVsLastWeekPct: number | null;
  todayHourly: { hour: string; revenue: number }[];
  week: { date: string; label: string; revenue: number; lastWeek: number; staffCost: number }[];
  weekRevenue: number;
  weekVsLastWeekPct: number | null;
  channels: Channel[];
  topDishes: { name: string; revenue: number; qty: number }[];
  platforms: PlatformRow[];
  platformsMissingYesterday: boolean;
  summary: {
    range: RangeKey;
    from: string;
    to: string;
    totalSales: number;
    exVat: number;
    costs: { ingredients: number; staff: number; expenses: number; commission: number; cardFees: number; total: number };
    profit: number;
  };
};

type OrderRow = { id: number; total: number; tax: number; order_type: string; created_at: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(dateStr: string): string {
  const wd = new Date(dateStr + "T00:00:00Z").getUTCDay(); // 0 = Sun
  return addDays(dateStr, -((wd + 6) % 7));
}

export function rangeDates(range: RangeKey, today: string): { from: string; to: string } {
  const mon = mondayOf(today);
  switch (range) {
    case "today": return { from: today, to: today };
    case "this_week": return { from: mon, to: addDays(mon, 6) };
    case "last_week": return { from: addDays(mon, -7), to: addDays(mon, -1) };
    case "this_month": {
      const first = today.slice(0, 8) + "01";
      const next = new Date(first + "T00:00:00Z");
      next.setUTCMonth(next.getUTCMonth() + 1);
      return { from: first, to: addDays(next.toISOString().slice(0, 10), -1) };
    }
    case "last_month": {
      const first = new Date(today.slice(0, 8) + "01T00:00:00Z");
      first.setUTCMonth(first.getUTCMonth() - 1);
      const from = first.toISOString().slice(0, 10);
      return { from, to: addDays(today.slice(0, 8) + "01", -1) };
    }
  }
}

const dayOf = (o: { created_at: string }) => tradingDayStr(new Date(o.created_at));
const dayLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short" });

// Supabase caps a select at 1000 rows — page through so a busy month isn't cut short.
async function allRows<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function chunked<T>(ids: number[], fetch: (ids: number[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 300) out.push(...(await fetch(ids.slice(i, i + 300))));
  return out;
}

async function paidOrders(from: string, to: string): Promise<OrderRow[]> {
  const { start } = tradingRangeUtc(from);
  const { end } = tradingRangeUtc(to);
  return allRows<OrderRow>((a, b) =>
    supabase.from("orders").select("id, total, tax, order_type, created_at").eq("is_paid", true)
      .gte("created_at", start).lte("created_at", end).order("id").range(a, b),
  );
}

// Payments against these orders: refunds (negative rows) and card takings.
async function paymentsFor(orderIds: number[]): Promise<{ refunds: Map<number, number>; card: Map<number, number> }> {
  const rows = await chunked(orderIds, async (ids) => {
    const { data, error } = await supabase.from("payments").select("order_id, amount, method").in("order_id", ids);
    if (error) throw error;
    return data ?? [];
  });
  const refunds = new Map<number, number>();
  const card = new Map<number, number>();
  for (const p of rows) {
    const amt = Number(p.amount);
    if (amt < 0) refunds.set(p.order_id, (refunds.get(p.order_id) ?? 0) - amt);
    else if (p.method === "card") card.set(p.order_id, (card.get(p.order_id) ?? 0) + amt);
  }
  // A card refund hands the money back; the fee usually isn't returned, so card stays gross.
  return { refunds, card };
}

type NetOrder = OrderRow & { net: number; netTax: number };

function netOf(orders: OrderRow[], refunds: Map<number, number>): NetOrder[] {
  return orders.map((o) => {
    const total = Number(o.total);
    const net = Math.max(0, total - (refunds.get(o.id) ?? 0));
    return { ...o, net, netTax: total > 0 ? Number(o.tax) * (net / total) : 0 };
  });
}

type PlatformSaleRow = { sales_date: string; platform: PlatformKey; orders: number; sales: number; commission: number };

async function platformSales(from: string, to: string): Promise<PlatformSaleRow[]> {
  const { data, error } = await supabase
    .from("platform_sales").select("sales_date, platform, orders, sales, commission")
    .eq("business_id", 1).gte("sales_date", from).lte("sales_date", to);
  // Don't take the whole dashboard down over the platform figures.
  if (error) { console.error("platform_sales:", error.message); return []; }
  return (data ?? []).map((r) => ({ ...r, orders: Number(r.orders), sales: Number(r.sales), commission: Number(r.commission) }));
}

/** Labour cost per work date from clocked-out shifts (hours × pay rate). */
async function staffCostByDay(from: string, to: string): Promise<Map<string, number>> {
  const { data } = await supabase.from("attendance").select("staff_id, work_date, net_work_seconds, clock_out")
    .gte("work_date", from).lte("work_date", to).not("clock_out", "is", null);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.staff_id))];
  const { data: staff } = ids.length ? await supabase.from("staff").select("id, pay_rate").in("id", ids) : { data: [] };
  const rate = new Map((staff ?? []).map((s) => [s.id, Number(s.pay_rate ?? 0)]));
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const cost = (Number(r.net_work_seconds ?? 0) / 3600) * (rate.get(r.staff_id) ?? 0);
    byDay.set(r.work_date, (byDay.get(r.work_date) ?? 0) + cost);
  }
  return byDay;
}

const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);

const OWN_CHANNELS: { key: string; label: string }[] = [
  { key: "dine_in", label: "Dine-in" },
  { key: "takeaway", label: "Collection" },
  { key: "delivery", label: "Website delivery" },
];

export async function getAdminDashboard(range: RangeKey): Promise<AdminDashboard> {
  const today = tradingDayStr();
  const mon = mondayOf(today);
  const sun = addDays(mon, 6);
  const lastMon = addDays(mon, -7);
  const sum = rangeDates(range, today);
  const yesterday = addDays(today, -1);

  // One fetch covering last week → this week (and the summary range, when it's inside).
  const summaryInside = sum.from >= lastMon && sum.to <= sun;
  const [orders14, plat14, costByDay, vatRate] = await Promise.all([
    paidOrders(lastMon, sun),
    platformSales(lastMon, sun),
    staffCostByDay(mon, sun),
    getVatRate(),
  ]);
  const pay14 = await paymentsFor(orders14.map((o) => o.id));
  const net14 = netOf(orders14, pay14.refunds);

  const ownByDay = new Map<string, number>();
  for (const o of net14) ownByDay.set(dayOf(o), (ownByDay.get(dayOf(o)) ?? 0) + o.net);
  const platByDay = new Map<string, number>();
  for (const p of plat14) platByDay.set(p.sales_date, (platByDay.get(p.sales_date) ?? 0) + p.sales);
  const dayRevenue = (d: string) => r2((ownByDay.get(d) ?? 0) + (platByDay.get(d) ?? 0));

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(mon, i);
    return { date, label: dayLabel(date), revenue: dayRevenue(date), lastWeek: dayRevenue(addDays(date, -7)), staffCost: r2(costByDay.get(date) ?? 0) };
  });
  const weekRevenue = r2(week.reduce((s, d) => s + d.revenue, 0));
  // Compare like with like: last week up to the same weekday.
  const daysSoFar = week.filter((d) => d.date <= today);
  const lastWeekSoFar = daysSoFar.reduce((s, d) => s + d.lastWeek, 0);

  // Today by hour (UK clock), 11:00 → 04:00 with the trading day's small hours at the end.
  const hourly = new Map<number, number>();
  const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false });
  for (const o of net14) {
    if (dayOf(o) !== today) continue;
    const h = Number(hourFmt.format(new Date(o.created_at))) % 24;
    hourly.set(h, (hourly.get(h) ?? 0) + o.net);
  }
  const hours = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  for (const h of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) if (hourly.has(h)) (h < 5 ? hours.push(h) : hours.unshift(h));
  hours.sort((a, b) => ((a + 19) % 24) - ((b + 19) % 24)); // 5am first
  const todayHourly = hours.map((h) => ({ hour: `${String(h).padStart(2, "0")}:00`, revenue: r2(hourly.get(h) ?? 0) }));

  // Channels, this week.
  const weekOrders = net14.filter((o) => dayOf(o) >= mon);
  const weekPlat = plat14.filter((p) => p.sales_date >= mon);
  const channels: Channel[] = [
    ...OWN_CHANNELS.map((c) => {
      const os = weekOrders.filter((o) => o.order_type === c.key);
      return { key: c.key, label: c.label, platform: false, revenue: r2(os.reduce((s, o) => s + o.net, 0)), orders: os.length };
    }),
    ...PLATFORMS.map((p) => {
      const rows = weekPlat.filter((r) => r.platform === p.key);
      return { key: p.key, label: p.label, platform: true, revenue: r2(rows.reduce((s, r) => s + r.sales, 0)), orders: rows.reduce((s, r) => s + r.orders, 0) };
    }),
  ];

  const platforms: PlatformRow[] = PLATFORMS.map((p) => {
    const rows = weekPlat.filter((r) => r.platform === p.key);
    const sales = r2(rows.reduce((s, r) => s + r.sales, 0));
    const commission = r2(rows.reduce((s, r) => s + r.commission, 0));
    return { key: p.key, label: p.label, orders: rows.reduce((s, r) => s + r.orders, 0), sales, commission, keep: r2(sales - commission) };
  });

  // Top dishes by revenue, this week (own orders only — platforms aren't itemised).
  const items = await chunked(weekOrders.map((o) => o.id), async (ids) => {
    const { data, error } = await supabase.from("order_items").select("order_id, item_name, item_price, quantity")
      .in("order_id", ids).neq("status", "cancelled");
    if (error) throw error;
    return data ?? [];
  });
  const dish = new Map<string, { revenue: number; qty: number }>();
  for (const i of items) {
    const cur = dish.get(i.item_name) ?? { revenue: 0, qty: 0 };
    cur.revenue += Number(i.item_price) * Number(i.quantity);
    cur.qty += Number(i.quantity);
    dish.set(i.item_name, cur);
  }
  const topDishes = [...dish.entries()]
    .map(([name, v]) => ({ name, revenue: r2(v.revenue), qty: v.qty }))
    .sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Summary for the chosen range.
  let sumOrders: NetOrder[], sumPlat: PlatformSaleRow[], cardByOrder: Map<number, number>;
  if (summaryInside) {
    sumOrders = net14.filter((o) => dayOf(o) >= sum.from && dayOf(o) <= sum.to);
    sumPlat = plat14.filter((p) => p.sales_date >= sum.from && p.sales_date <= sum.to);
    cardByOrder = pay14.card;
  } else {
    const os = await paidOrders(sum.from, sum.to);
    const pay = await paymentsFor(os.map((o) => o.id));
    sumOrders = netOf(os, pay.refunds);
    sumPlat = await platformSales(sum.from, sum.to);
    cardByOrder = pay.card;
  }
  const card = sumOrders.reduce((s, o) => s + (cardByOrder.get(o.id) ?? 0), 0);
  const [ingredients, staff, expenses] = await Promise.all([
    getIngredientPurchases(sum.from, sum.to),
    getLabourCost(sum.from, sum.to),
    getOtherExpenses(sum.from, sum.to),
  ]);
  const ownSales = sumOrders.reduce((s, o) => s + o.net, 0);
  const ownVat = sumOrders.reduce((s, o) => s + o.netTax, 0);
  const platSales = sumPlat.reduce((s, p) => s + p.sales, 0);
  const commission = r2(sumPlat.reduce((s, p) => s + p.commission, 0));
  const totalSales = r2(ownSales + platSales);
  const exVat = r2(ownSales - ownVat + platSales / (1 + vatRate));
  const cardFees = r2(card * CARD_FEE_RATE);
  const costTotal = r2(ingredients + staff + expenses.total + commission + cardFees);

  const { count: yCount, error: yErr } = await supabase.from("platform_sales").select("id", { count: "exact", head: true })
    .eq("business_id", 1).eq("sales_date", yesterday);

  return {
    today,
    todayRevenue: dayRevenue(today),
    todayVsLastWeekPct: pct(dayRevenue(today), dayRevenue(addDays(today, -7))),
    todayHourly,
    week,
    weekRevenue,
    weekVsLastWeekPct: pct(daysSoFar.reduce((s, d) => s + d.revenue, 0), lastWeekSoFar),
    channels,
    topDishes,
    platforms,
    platformsMissingYesterday: !yErr && (yCount ?? 0) === 0,
    summary: {
      range, from: sum.from, to: sum.to, totalSales, exVat,
      costs: { ingredients, staff, expenses: expenses.total, commission, cardFees, total: costTotal },
      profit: r2(exVat - costTotal),
    },
  };
}
