// Rewards Club "claim your points" QR on dine-in receipts.
let receipt: unknown = null;
// Printed tickets carry the business's own header (lib/brand.ts) — The Royal Chilli here.
jest.mock("@/lib/brand", () => ({
  getBrand: async () => ({
    businessId: 1, name: "The Royal Chilli", address: "43 Kingsley Road, Hounslow TW3 1PA",
    fullAddress: "43 Kingsley Road, Hounslow, London, TW3 1PA", phone: "020 8797 3044", logoUrl: "/logo.png", tagline: "Dil Se Desi",
  }),
}));
jest.mock("@/lib/supabase", () => ({
  __esModule: true,
  default: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { business_id: 1 }, error: null }) }) }) }) },
}));
jest.mock("@/lib/receipt", () => ({ getOrderForReceipt: jest.fn(async () => receipt) }));
jest.mock("@/lib/kot", () => ({ getOrderForPrint: jest.fn(async () => null) }));
jest.mock("@/lib/z-report-db", () => ({ getZReport: jest.fn(async () => null) }));
jest.mock("@/lib/kitchen-rounds", () => ({ roundNumberFor: jest.fn(async () => null) }));
jest.mock("@/lib/claim", () => ({
  claimUrl: (id: number) => `https://example.test/claim?o=${id}&k=abc123abc123`,
  paidAtFor: jest.fn(async () => new Date("2026-10-07T19:00:00Z")),
  pointsForBill: jest.fn(async (_businessId: number, total: number) => Math.floor(total * 10) * 2),
}));

import { buildTicket, toPlainText, toStarPrnt, type PrintJob } from "@/lib/cloudprnt";
import { ticketHtml } from "@/lib/ticket-html";

const job: PrintJob = { id: 1, order_id: 42, work_period_id: null, kind: "receipt", source: "till", item_ids: null };
const order = (extra: Record<string, unknown> = {}) => ({
  order_type: "dine_in", table_number: "4", order_number: "RC-0042", created_at: "2026-10-07T18:00:00Z",
  subtotal: 48, discount: 0, service_charge_amount: 0, total: 48, tax: 8, amount_paid: 48, status: "paid",
  customer_id: null, customer_name: null, staff_name: null, ...extra,
});
const paid = { payments: [{ method: "card", amount: 48, tip_amount: 0 }], items: [] };

describe("receipt claim QR", () => {
  it("invites a guest (no member on the bill) to claim the bill's points", async () => {
    receipt = { order: order(), ...paid };
    const t = (await buildTicket(job))!;
    const text = t.map((l) => l.text);
    expect(text).toContain("JOIN OUR REWARDS CLUB");
    expect(text).toContain("Scan to claim 960 points");
    const qr = t.find((l) => l.qr)!;
    expect(qr.text).toBe("https://example.test/claim?o=42&k=abc123abc123");
    expect(qr.qrSvg).toMatch(/^<svg/);
  });

  it("no QR when a member is already on the bill, or it isn't dine-in, or it's unpaid", async () => {
    for (const o of [order({ customer_id: 7 }), order({ order_type: "delivery" }), order({ amount_paid: 0, status: "sent_to_kitchen" })]) {
      receipt = { order: o, ...paid, payments: o.amount_paid ? paid.payments : [] };
      const t = (await buildTicket(job))!;
      expect(t.some((l) => l.qr)).toBe(false);
    }
  });

  it("prints on every output: StarPRNT QR commands, the URL in plain text, the SVG in the browser", async () => {
    receipt = { order: order(), ...paid };
    const t = (await buildTicket(job))!;
    const bytes = Array.from(toStarPrnt(t));
    const printCmd = [0x1b, 0x1d, 0x79, 0x50];
    expect(bytes.some((_, i) => printCmd.every((b, j) => bytes[i + j] === b))).toBe(true);
    expect(toPlainText(t)).toContain("claim?o=42");
    expect(ticketHtml(t)).toContain('<div class="qr"><svg');
  });
});

describe("receipt bill lines", () => {
  it("prints subtotal → service charge → tip → discount → loyalty → TOTAL (tip included), payments with their tip", async () => {
    receipt = {
      order: order({ customer_id: 7, subtotal: 100, discount: 10, discount_reason: "Staff", loyalty_discount: 5, loyalty_reason: "Loyalty credit", service_charge_amount: 8.5, total: 93.5, tax: 14.17 }),
      items: [],
      payments: [{ method: "card", amount: 93.5, tip_amount: 5 }],
    };
    const text = (await buildTicket(job))!.map((l) => l.text);
    const at = (label: string) => text.findIndex((l) => l.startsWith(label));
    const order_ = ["Subtotal", "Service Charge", "Tip", "Discount (Staff)", "Loyalty credit", "TOTAL", "incl. VAT"].map(at);
    expect(order_.every((i) => i >= 0)).toBe(true);
    expect([...order_].sort((a, b) => a - b)).toEqual(order_);
    expect(text[at("TOTAL")]).toMatch(/98\.50$/);
    expect(text[at("Card")]).toMatch(/98\.50$/);
    expect(text.some((l) => l.includes("tip)"))).toBe(false);
  });
});
