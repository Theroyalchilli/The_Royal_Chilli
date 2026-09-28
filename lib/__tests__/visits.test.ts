jest.mock("@/lib/supabase", () => ({ __esModule: true, default: {} }));

import { visitBonusFor, visitNumber, type VisitBonusRules } from "@/lib/visits";

const rules: VisitBonusRules = { fixed: { 2: 200, 3: 300 }, everyN: 5, everyPoints: 500 };

describe("visit bonus amounts", () => {
  it("2nd +200, 3rd +300, every 5th +500, nothing otherwise", () => {
    expect([1, 2, 3, 4, 5, 6, 9, 10, 15].map((v) => visitBonusFor(v, rules))).toEqual([0, 200, 300, 0, 500, 0, 0, 500, 500]);
  });
  it("no every-Nth rule set → only the fixed visits", () => {
    expect(visitBonusFor(5, { fixed: { 2: 200 }, everyN: 0, everyPoints: 500 })).toBe(0);
  });
});

describe("which visit an order is", () => {
  // BST: 19:00 UTC = 20:00 UK. Trading day = 5am–5am.
  const o = (id: number, created_at: string) => ({ id, created_at });
  const history = [
    o(1, "2026-10-05T19:00:00Z"), // Mon evening — visit 1
    o(2, "2026-10-07T19:00:00Z"), // Wed evening — visit 2
    o(3, "2026-10-07T23:30:00Z"), // Thu 00:30 — still Wednesday's trading day: same visit
    o(4, "2026-10-09T12:00:00Z"), // Fri lunch — visit 3
  ];

  it("counts trading days, first bill of the day gets the number", () => {
    expect(visitNumber(1, history)).toBe(1);
    expect(visitNumber(2, history)).toBe(2);
    expect(visitNumber(4, history)).toBe(3);
  });
  it("a second bill the same night is the same visit — no second bonus", () => {
    expect(visitNumber(3, history)).toBe(0);
  });
  it("an order not in the list isn't a visit", () => {
    expect(visitNumber(99, history)).toBe(0);
  });
});
