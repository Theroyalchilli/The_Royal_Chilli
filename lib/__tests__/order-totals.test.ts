import { computeBill } from "@/lib/order-totals";

// Order of operations (confirmed with the owner): subtotal -> VAT -> discount
// -> service charge -> total. Tip is never part of this (per-payment, separate).
describe("computeBill", () => {
  it("adds 20% VAT with no discount or service charge", () => {
    const bill = computeBill({ subtotal: 100, discountType: null, discountPct: null, discountAmount: 0, serviceChargePct: 0 });
    expect(bill).toMatchObject({ subtotal: 100, tax: 20, subtotalWithTax: 120, discount: 0, discounted: 120, serviceChargeAmount: 0, total: 120 });
  });

  it("applies a percent discount to the VAT-inclusive amount, not the pre-VAT subtotal", () => {
    const bill = computeBill({ subtotal: 100, discountType: "percent", discountPct: 10, discountAmount: 0, serviceChargePct: 0 });
    // subtotalWithTax = 120; 10% of 120 = 12
    expect(bill).toMatchObject({ tax: 20, subtotalWithTax: 120, discount: 12, discounted: 108, total: 108 });
  });

  it("applies a flat-amount discount off the VAT-inclusive amount", () => {
    const bill = computeBill({ subtotal: 100, discountType: "amount", discountPct: null, discountAmount: 20, serviceChargePct: 0 });
    expect(bill).toMatchObject({ subtotalWithTax: 120, discount: 20, discounted: 100, total: 100 });
  });

  it("clamps the discount so it never exceeds the VAT-inclusive amount (never a negative total)", () => {
    const bill = computeBill({ subtotal: 10, discountType: "amount", discountPct: null, discountAmount: 200, serviceChargePct: 0 });
    expect(bill).toMatchObject({ subtotalWithTax: 12, discount: 12, discounted: 0, serviceChargeAmount: 0, total: 0 });
  });

  it("applies service charge on the post-discount amount, last", () => {
    const bill = computeBill({ subtotal: 100, discountType: "amount", discountPct: null, discountAmount: 20, serviceChargePct: 10 });
    // discounted = 100; service charge = 10% of 100 = 10
    expect(bill).toMatchObject({ discounted: 100, serviceChargeAmount: 10, total: 110 });
  });

  it("treats a null discount type as a legacy flat amount, same as \"amount\"", () => {
    const bill = computeBill({ subtotal: 100, discountType: null, discountPct: null, discountAmount: 10, serviceChargePct: 0 });
    expect(bill).toMatchObject({ discount: 10, discounted: 110, total: 110 });
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
  it("sums active items and writes back the computed bill", async () => {
    itemRows = [{ item_price: 10, quantity: 2 }, { item_price: 5, quantity: 1 }];
    await recalcTotals("order-1");
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 25, tax: 5, service_charge_amount: 0, total: 30 })
    );
  });

  it("does NOT overwrite the stored discount for a flat-amount discount (it's the raw rule, not a cache)", async () => {
    orderRow = { discount: 20, discount_type: "amount", discount_pct: null, service_charge_pct: 0 };
    itemRows = [{ item_price: 100, quantity: 1 }];
    await recalcTotals("order-1");
    const written = updateSpy.mock.calls[0][0];
    expect(written).not.toHaveProperty("discount");
    expect(written.total).toBe(100); // 100 + 20 tax - 20 discount
  });

  it("DOES refresh the stored discount for a percent discount (it's a derived display cache)", async () => {
    orderRow = { discount: 0, discount_type: "percent", discount_pct: 10, service_charge_pct: 0 };
    itemRows = [{ item_price: 100, quantity: 1 }];
    await recalcTotals("order-1");
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ discount: 12, total: 108 }));
  });

  it("applies service charge after the discount", async () => {
    orderRow = { discount: 20, discount_type: "amount", discount_pct: null, service_charge_pct: 10 };
    itemRows = [{ item_price: 100, quantity: 1 }];
    await recalcTotals("order-1");
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ service_charge_amount: 10, total: 110 }));
  });
});
