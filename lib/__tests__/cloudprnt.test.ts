// Ticket rendering for the CloudPRNT printer: which items a kitchen ticket
// lists, and the StarPRNT / plain-text encodings the printer receives.
type Item = { id: number; item_name: string; quantity: number; notes: string | null; status: string; modifiers: string[] };
let printData: { order: Record<string, unknown>; items: Item[] } | null;

jest.mock("@/lib/kot", () => ({ getOrderForPrint: jest.fn(async () => printData) }));
jest.mock("@/lib/receipt", () => ({ getOrderForReceipt: jest.fn(async () => null) }));

import { buildTicket, encodeCp437, toPlainText, toStarPrnt, type PrintJob } from "@/lib/cloudprnt";

const item = (id: number, name: string, extra: Partial<Item> = {}): Item => ({
  id, item_name: name, quantity: 1, notes: null, status: "pending", modifiers: [], ...extra,
});

const baseOrder = {
  status: "sent_to_kitchen", order_type: "dine_in", table_number: "7", order_number: "RC-0142",
  created_at: "2026-09-26T13:32:00Z", scheduled_for: null, customer_name: null, customer_phone: null,
  customer_address: null, customer_postcode: null, notes: null, total: 20, amount_paid: 0,
};

const job = (extra: Partial<PrintJob> = {}): PrintJob => ({ id: 1, order_id: 5, kind: "kot", source: "qr", item_ids: null, ...extra });
const texts = (t: { text: string }[] | null) => (t ?? []).map((l) => l.text);

describe("buildTicket (kitchen)", () => {
  it("lists only the round's items and flags it as an add-on", async () => {
    printData = { order: baseOrder, items: [item(1, "Samosa"), item(2, "Chicken Tikka"), item(3, "Garlic Naan")] };
    const lines = texts(await buildTicket(job({ item_ids: [2, 3] })));
    expect(lines).toContain("*** QR ORDER ***");
    expect(lines).toContain("TABLE 7");
    expect(lines).toContain("+ ADDITIONAL ITEMS +");
    expect(lines).toContain("1x Chicken Tikka");
    expect(lines).not.toContain("1x Samosa");
  });

  it("shows the whole order without an add-on flag when item_ids is null", async () => {
    printData = { order: baseOrder, items: [item(1, "Samosa")] };
    const lines = texts(await buildTicket(job({ source: "till" })));
    expect(lines).toContain("*** TILL ***");
    expect(lines).not.toContain("+ ADDITIONAL ITEMS +");
  });

  it("highlights item notes and labels manual reprints", async () => {
    printData = { order: baseOrder, items: [item(1, "Korma", { notes: "no nuts - allergy" })] };
    const lines = texts(await buildTicket(job({ source: null })));
    expect(lines).toContain("*** REPRINT ***");
    expect(lines).toContain("   *** NO NUTS - ALLERGY ***");
  });

  it("prints nothing for a cancelled order", async () => {
    printData = { order: { ...baseOrder, status: "cancelled" }, items: [item(1, "Samosa")] };
    expect(await buildTicket(job())).toBeNull();
  });

  it("prints nothing when none of the round's items are left", async () => {
    printData = { order: baseOrder, items: [item(1, "Samosa")] };
    expect(await buildTicket(job({ item_ids: [99] }))).toBeNull();
  });

  it("shows the scheduled slot and what's still to pay on online orders, in London time", async () => {
    printData = {
      order: { ...baseOrder, order_type: "takeaway", table_number: null, scheduled_for: "2026-09-26T18:00:00Z", total: 25, amount_paid: 0 },
      items: [item(1, "Biryani")],
    };
    const lines = texts(await buildTicket(job({ source: "online" })));
    expect(lines).toContain("COLLECTION");
    expect(lines).toContain("FOR 19:00"); // BST = UTC+1
    expect(lines).toContain("TO PAY: £25.00");
  });
});

describe("encoders", () => {
  it("encodes £ as CP437 and swaps other non-ASCII characters", () => {
    expect(encodeCp437("£5")).toEqual([0x9c, 0x35]);
    expect(encodeCp437("café — ok")).toEqual([..."cafe - ok"].map((c) => c.charCodeAt(0)));
    expect(encodeCp437("🌶")).toEqual([0x3f]); // one "?" per emoji
  });

  it("wraps StarPRNT output with init, styles and a cut", () => {
    const bytes = Array.from(toStarPrnt([{ text: "HI", bold: true, size: "big", align: "center" }]));
    expect(bytes.slice(0, 2)).toEqual([0x1b, 0x40]);
    expect(bytes).toEqual(expect.arrayContaining([0x1b, 0x45])); // bold on
    const text = bytes.indexOf(0x48);
    expect(bytes.slice(text - 4, text)).toEqual([0x1b, 0x69, 1, 1]); // double size just before the text
    expect(bytes.slice(-3)).toEqual([0x1b, 0x64, 3]);
  });

  it("centres plain text", () => {
    expect(toPlainText([{ text: "HI", align: "center" }]).split("\n")[0]).toBe(" ".repeat(23) + "HI");
  });
});
