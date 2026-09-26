// "Is it paid?" by money received, not orders.status — an online-paid order
// stays "sent_to_kitchen" until the kitchen's done with it.
import { amountHeld, isFullyPaid } from "@/lib/payment-status";

describe("isFullyPaid", () => {
  it("counts an online-paid order still in the kitchen as paid", () => {
    expect(isFullyPaid({ status: "sent_to_kitchen", total: 14.95, amount_paid: 14.95 })).toBe(true);
  });

  it("isn't fooled by part-payment, nothing paid, or a £0 order", () => {
    expect(isFullyPaid({ status: "sent_to_kitchen", total: 20, amount_paid: 5 })).toBe(false);
    expect(isFullyPaid({ status: "open", total: 20, amount_paid: 0 })).toBe(false);
    expect(isFullyPaid({ status: "open", total: 0, amount_paid: 0 })).toBe(false);
  });

  it("trusts status 'paid' from the till", () => {
    expect(isFullyPaid({ status: "paid", total: 20, amount_paid: 20 })).toBe(true);
  });
});

describe("amountHeld", () => {
  it("reports money still held, e.g. on a cancelled online order", () => {
    expect(amountHeld({ status: "cancelled", total: 14.95, amount_paid: 14.95 })).toBe(14.95);
  });

  it("is zero once refunded", () => {
    expect(amountHeld({ status: "cancelled", total: 14.95, amount_paid: 0 })).toBe(0);
    expect(amountHeld({ status: "cancelled", total: 14.95, amount_paid: null })).toBe(0);
  });
});
