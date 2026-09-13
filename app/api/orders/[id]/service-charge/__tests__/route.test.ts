import { NextRequest } from "next/server";
import type { SessionUser } from "@/lib/types";

type Resp = { data?: unknown; error?: unknown };
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
      const passthrough = ["select", "eq", "neq", "order"];
      for (const m of passthrough) builder[m] = () => builder;
      builder.update = (vals: Record<string, unknown>) => {
        if (table === "orders") ordersUpdatePayloads.push(vals);
        return builder;
      };
      builder.single = () => Promise.resolve(resp);
      builder.then = (resolve: (v: Resp) => void, reject: (e: unknown) => void) => Promise.resolve(resp).then(resolve, reject);
      return builder;
    },
  },
}));

import { POST } from "@/app/api/orders/[id]/service-charge/route";
import { authedRequest } from "@/app/api/_test-helpers";

const manager: SessionUser = { id: 2, name: "A Manager", role: "manager" };

async function setServiceCharge(orderId: string, pct: number) {
  const req = await authedRequest(`http://localhost/api/orders/${orderId}/service-charge`, manager, {
    method: "POST",
    body: JSON.stringify({ pct }),
  });
  return POST(req as NextRequest, { params: Promise.resolve({ id: orderId }) });
}

beforeEach(() => {
  queues = {};
  ordersUpdatePayloads = [];
});

describe("POST /api/orders/[id]/service-charge", () => {
  it("sets the service charge and recomputes the bill", async () => {
    queue("orders", { data: { status: "open" }, error: null }); // settlement check
    queue("orders", { data: null, error: null }); // service_charge_pct update
    queue("orders", { data: { discount: 0, discount_type: null, discount_pct: null, service_charge_pct: 10 }, error: null }); // recalcTotals read
    queue("order_items", { data: [{ item_price: 100, quantity: 1 }], error: null }); // recalcTotals items
    queue("orders", { data: null, error: null }); // recalcTotals write
    queue("orders", { data: { id: 1, total: 132 }, error: null }); // final refetch

    const res = await setServiceCharge("1", 10);
    expect(res.status).toBe(200);
    expect(ordersUpdatePayloads[0]).toMatchObject({ service_charge_pct: 10 });
  });

  it("409s once the order is already fully paid", async () => {
    queue("orders", { data: { status: "paid" }, error: null });
    const res = await setServiceCharge("1", 10);
    expect(res.status).toBe(409);
    expect(ordersUpdatePayloads).toHaveLength(0);
  });
});
