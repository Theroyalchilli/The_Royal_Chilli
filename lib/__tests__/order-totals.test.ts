import { computeBill } from "@/lib/order-totals";

// Order of operations: subtotal (already VAT-inclusive) -> discount ->
// service charge -> total. Tip is never part of this (per-payment,
// separate). `tax` is the VAT component embedded in the final total,
// reported for receipts/VAT-return purposes — it never adds to what the
// customer pays, since the menu price they saw already included it.
describe("computeBill", () => {
  it("reports the embedded VAT component with no discount or service charge", () => {
    const bill = computeBill({ subtotal: 100, discountType: null, discountPct: null, discountAmount: 0, serviceChargePct: 0 });
    // total stays 100 (nothing added); VAT component of an inclusive £100 = 100 - 100/1.2 = 16.67
    expect(bill).toMatchObject({ subtotal: 100, tax: 16.67, subtotalWithTax: 100, discount: 0, discounted: 100, serviceChargeAmount: 0, total: 100 });
  });

  it("applies a percent discount directly to the inclusive subtotal", () => {
    const bill = computeBill({ subtotal: 100, discountType: "percent", discountPct: 10, discountAmount: 0, serviceChargePct: 0 });
    // 10% of 100 = 10; discounted total = 90; VAT component of 90 = 15
    expect(bill).toMatchObject({ discount: 10, discounted: 90, total: 90, tax: 15 });
  });

  it("applies a flat-amount discount off the inclusive subtotal", () => {
    const bill = computeBill({ subtotal: 100, discountType: "amount", discountPct: null, discountAmount: 20, serviceChargePct: 0 });
    expect(bill).toMatchObject({ subtotalWithTax: 100, discount: 20, discounted: 80, total: 80 });
  });

  it("clamps the discount so it never exceeds the subtotal (never a negative total)", () => {
    const bill = computeBill({ subtotal: 10, discountType: "amount", discountPct: null, discountAmount: 200, serviceChargePct: 0 });
    expect(bill).toMatchObject({ subtotalWithTax: 10, discount: 10, discounted: 0, serviceChargeAmount: 0, total: 0, tax: 0 });
  });

  it("applies service charge on the post-discount amount, last", () => {
    const bill = computeBill({ subtotal: 100, discountType: "amount", discountPct: null, discountAmount: 20, serviceChargePct: 10 });
    // discounted = 80; service charge = 10% of 80 = 8
    expect(bill).toMatchObject({ discounted: 80, serviceChargeAmount: 8, total: 88 });
  });

  it("treats a null discount type as a legacy flat amount, same as \"amount\"", () => {
    const bill = computeBill({ subtotal: 100, discountType: null, discountPct: null, discountAmount: 10, serviceChargePct: 0 });
    expect(bill).toMatchObject({ discount: 10, discounted: 90, total: 90 });
  });
});

// Mirrors permissions.test.ts's approach: mock the Supabase client so
// recalcTotals can run against controlled order/order_items data without a
// live database.
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
  orderRow = { discount: 0, discount_type: null, discount_pct: null, service_charge_pct: 0 };
  itemRows = [];
});

describe("recalcTotals", () => {
  it("sums active items (already VAT-inclusive) and writes back the computed bill", async () => {
    itemRows = [{ item_price: 10, quantity: 2 }, { item_price: 5, quantity: 1 }];
    await recalcTotals("order-1");
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 25, tax: 4.17, service_charge_amount: 0, total: 25 })
    );
  });

  it("does NOT overwrite the stored discount for a flat-amount discount (it's the raw rule, not a cache)", async () => {
    orderRow = { discount: 20, discount_type: "amount", discount_pct: null, service_charge_pct: 0 };
    itemRows = [{ item_price: 100, quantity: 1 }];
    await recalcTotals("order-1");
    const written = updateSpy.mock.calls[0][0];
    expect(written).not.toHaveProperty("discount");
    expect(written.total).toBe(80); // 100 inclusive - 20 discount
  });

  it("DOES refresh the stored discount for a percent discount (it's a derived display cache)", async () => {
    orderRow = { discount: 0, discount_type: "percent", discount_pct: 10, service_charge_pct: 0 };
    itemRows = [{ item_price: 100, quantity: 1 }];
    await recalcTotals("order-1");
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ discount: 10, total: 90 }));
  });

  it("applies service charge after the discount", async () => {
    orderRow = { discount: 20, discount_type: "amount", discount_pct: null, service_charge_pct: 10 };
    itemRows = [{ item_price: 100, quantity: 1 }];
    await recalcTotals("order-1");
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ service_charge_amount: 8, total: 88 }));
  });
});
