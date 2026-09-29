// The Z report picks payments up by time — everything taken while the till
// was open — so it must only count the shift's own business's payments.
// This fake database holds a Royal Chilli (1) and a Melt House (2) payment
// taken during the same shift, and applies whatever filters the code asks for.
type Row = Record<string, unknown>;

const tables: Record<string, Row[]> = {
  work_periods: [{ id: 10, business_id: 1, opened_at: "2026-09-29T09:00:00Z", closed_at: "2026-09-29T23:00:00Z", opening_cash: 100, closing_cash: null, status: "closed", opened_by: null, closed_by: null }],
  payments: [
    { order_id: 1, method: "card", amount: 20, tip_amount: 0, business_id: 1, created_at: "2026-09-29T12:00:00Z" },
    { order_id: 2, method: "card", amount: 7, tip_amount: 0, business_id: 2, created_at: "2026-09-29T12:05:00Z" },
  ],
  orders: [
    { id: 1, order_number: "RC-1", work_period_id: 10, status: "paid", pay_later: false, total: 20, amount_paid: 20, discount: 0, customer_name: null, created_at: "2026-09-29T11:55:00Z", business_id: 1 },
    { id: 2, order_number: "MH-1", work_period_id: 99, status: "paid", pay_later: false, total: 7, amount_paid: 7, discount: 0, customer_name: null, created_at: "2026-09-29T12:00:00Z", business_id: 2 },
  ],
  cash_paid_outs: [],
  staff: [],
};

jest.mock("../supabase", () => {
  const query = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (c: string, v: unknown) => { rows = rows.filter((r) => r[c] === v); return chain; },
      in: (c: string, vs: unknown[]) => { rows = rows.filter((r) => vs.includes(r[c])); return chain; },
      gte: (c: string, v: string) => { rows = rows.filter((r) => String(r[c]) >= v); return chain; },
      lte: (c: string, v: string) => { rows = rows.filter((r) => String(r[c]) <= v); return chain; },
      order: () => chain,
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(res, rej),
    };
    return chain;
  };
  return { __esModule: true, default: { from: query } };
});

import { calculateZReport } from "@/lib/z-report-db";

it("a shift's Z report counts only its own business's payments", async () => {
  const report = await calculateZReport(10);
  expect(report).not.toBeNull();
  expect(report!.payments.card).toBe(20); // Melt House's £7 card payment isn't in Royal Chilli's Z
});
