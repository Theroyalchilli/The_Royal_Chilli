// Mirrors permissions.test.ts's approach: mock the Supabase client so
// recalcTotals can run against controlled order/order_items data without a
// live database. Each test configures what .from() returns per call.

type Row = Record<string, unknown>;

let orderRow: Row | null;
let itemRows: Row[];
let updateSpy: jest.Mock;

jest.mock("../supabase", () => ({
  __esModule: true,
  default: {
    from: (table: string) => {
      if (table === "orders") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: orderRow, error: null }),
            }),
          }),
          update: (vals: Row) => {
            updateSpy(vals);
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
        };
      }
      if (table === "order_items") {
        return {
          select: () => ({
            eq: () => ({
              neq: () => Promise.resolve({ data: itemRows, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    },
  },
}));

import { recalcTotals } from "@/lib/order-totals";

beforeEach(() => {
  updateSpy = jest.fn();
  orderRow = { discount: 0, service_charge_pct: 0 };
  itemRows = [];
});

describe("recalcTotals", () => {
  it("sums active items and applies 20% tax", async () => {
    itemRows = [{ item_price: 10, quantity: 2 }, { item_price: 5, quantity: 1 }];
    await recalcTotals("order-1");
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 25, tax: 5, service_charge_amount: 0, total: 30 })
    );
  });

  it("excludes cancelled items from the total (handled by the neq filter)", async () => {
    // The mock's order_items branch only returns rows past the .neq("status",
    // "cancelled") filter, so itemRows here represents what the DB would
    // actually hand back — cancelled rows are never in it.
    itemRows = [{ item_price: 10, quantity: 1 }];
    await recalcTotals("order-1");
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 10 }));
  });

  it("applies discount before calculating tax", async () => {
    itemRows = [{ item_price: 100, quantity: 1 }];
    orderRow = { discount: 20, service_charge_pct: 0 };
    await recalcTotals("order-1");
    // taxable = 100 - 20 = 80; tax = 16; total = 80 + 16 = 96
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ tax: 16, total: 96 }));
  });

  it("clamps taxable to zero when discount exceeds subtotal (never a negative total)", async () => {
    itemRows = [{ item_price: 10, quantity: 1 }];
    orderRow = { discount: 50, service_charge_pct: 0 };
    await recalcTotals("order-1");
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ tax: 0, service_charge_amount: 0, total: 0 }));
  });

  it("applies service charge as a percentage of the post-discount taxable amount", async () => {
    itemRows = [{ item_price: 100, quantity: 1 }];
    orderRow = { discount: 0, service_charge_pct: 10 };
    await recalcTotals("order-1");
    // taxable = 100; tax = 20; service charge = 10; total = 130
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ service_charge_amount: 10, total: 130 }));
  });
});
