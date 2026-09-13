// Regression coverage for the new discount rule (percent/amount/null),
// consolidated bill math, and the settlement guard. Same FIFO-per-table mock
// approach as app/api/orders/[id]/items/__tests__/route.test.ts, since this
// handler (via recalcTotals) makes several sequential calls to "orders" and
// "order_items" within one request.
import { NextRequest } from "next/server";
import type { SessionUser } from "@/lib/types";

type Resp = { data?: unknown; error?: unknown; count?: number };
let queues: Record<string, Resp[]>;
let ordersUpdatePayloads: Record<string, unknown>[];

function queue(table: string, resp: Resp) {
  (queues[table] ||= []).push(resp);
}

jest.mock("@/lib/supabase", () => ({
  __esModule: true,
  default: {
    from: (table: string) => {
      const q = queues[table];
      if (!q || q.length === 0) throw new Error(`No queued response for table "${table}"`);
      const resp = q.shift()!;
      const builder: Record<string, unknown> = {};
      const passthrough = ["select", "eq", "neq", "in", "gte", "lte", "not", "order", "limit", "insert"];
      for (const m of passthrough) builder[m] = () => builder;
      builder.update = (vals: Record<string, unknown>) => {
        if (table === "orders") ordersUpdatePayloads.push(vals);
        return builder;
      };
      builder.single = () => Promise.resolve(resp);
      builder.maybeSingle = () => Promise.resolve(resp);
      builder.then = (resolve: (v: Resp) => void, reject: (e: unknown) => void) => Promise.resolve(resp).then(resolve, reject);
      return builder;
    },
  },
}));

import { PUT } from "@/app/api/orders/[id]/route";
import { authedRequest } from "@/app/api/_test-helpers";

const manager: SessionUser = { id: 2, name: "A Manager", role: "manager" };

async function patchOrder(orderId: string, body: unknown) {
  const req = await authedRequest(`http://localhost/api/orders/${orderId}`, manager, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return PUT(req as NextRequest, { params: Promise.resolve({ id: orderId }) });
}

// Queues the sequence recalcTotals + the final response-refetch make, after
// whatever the discount-specific update queued first.
function queueRecalcAndRefetch(opts: { discountType?: string | null; discountPct?: number | null; discount?: number; serviceChargePct?: number; finalOrder?: Resp["data"] }) {
  queue("orders", { data: { discount: opts.discount ?? 0, discount_type: opts.discountType ?? null, discount_pct: opts.discountPct ?? null, service_charge_pct: opts.serviceChargePct ?? 0 }, error: null }); // recalcTotals read
  queue("order_items", { data: [{ item_price: 100, quantity: 1 }], error: null }); // recalcTotals items
  queue("orders", { data: null, error: null }); // recalcTotals write
  queue("orders", { data: opts.finalOrder ?? { id: 1, total: 100 }, error: null }); // final refetch for response
}

beforeEach(() => {
  queues = {};
  ordersUpdatePayloads = [];
});

describe("PUT /api/orders/[id] — discount rule", () => {
  it("applies a percent discount and recomputes the bill", async () => {
    queue("orders", { data: { id: 1, table_id: null, status: "open" }, error: null }); // initial fetch
    queue("orders", { data: null, error: null }); // discount_type update
    queueRecalcAndRefetch({ discountType: "percent", discountPct: 10 });

    const res = await patchOrder("1", { discount_type: "percent", discount_value: 10, discount_reason: "loyalty" });
    expect(res.status).toBe(200);
    expect(ordersUpdatePayloads[0]).toMatchObject({ discount_type: "percent", discount_pct: 10, discount_reason: "loyalty" });
  });

  it("rejects a percent discount value outside 0-100", async () => {
    queue("orders", { data: { id: 1, table_id: null, status: "open" }, error: null });
    const res = await patchOrder("1", { discount_type: "percent", discount_value: 150 });
    expect(res.status).toBe(400);
  });

  it("applies a flat-amount discount", async () => {
    queue("orders", { data: { id: 1, table_id: null, status: "open" }, error: null });
    queue("orders", { data: null, error: null }); // discount_type update
    queueRecalcAndRefetch({ discountType: "amount", discount: 15 });

    const res = await patchOrder("1", { discount_type: "amount", discount_value: 15 });
    expect(res.status).toBe(200);
    expect(ordersUpdatePayloads[0]).toMatchObject({ discount_type: "amount", discount: 15 });
  });

  it("clears the discount when discount_type is null", async () => {
    queue("orders", { data: { id: 1, table_id: null, status: "open" }, error: null });
    queue("orders", { data: null, error: null }); // clear update
    queueRecalcAndRefetch({});

    const res = await patchOrder("1", { discount_type: null });
    expect(res.status).toBe(200);
    expect(ordersUpdatePayloads[0]).toMatchObject({ discount_type: null, discount_pct: null, discount: 0 });
  });

  it("409s a discount change on an order that's already fully paid", async () => {
    queue("orders", { data: { id: 1, table_id: null, status: "paid" }, error: null });
    const res = await patchOrder("1", { discount_type: "amount", discount_value: 5 });
    expect(res.status).toBe(409);
    expect(ordersUpdatePayloads).toHaveLength(0);
  });
});
