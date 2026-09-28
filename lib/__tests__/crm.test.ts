jest.mock("../supabase", () => ({
  __esModule: true,
  default: { from: () => ({ select: () => Promise.resolve({ data: null, error: null }) }) },
}));

import { tierForSpend, computeSegment, countVisits, type LoyaltyTier } from "@/lib/crm";

describe("tierForSpend", () => {
  const tiers: LoyaltyTier[] = [
    { id: 1, name: "Bronze", min_lifetime_spend: 0, points_multiplier: 1.0 },
    { id: 2, name: "Silver", min_lifetime_spend: 200, points_multiplier: 1.25 },
    { id: 3, name: "Gold", min_lifetime_spend: 500, points_multiplier: 1.5 },
  ];

  it("picks the lowest tier for a brand new customer", () => {
    expect(tierForSpend(tiers, 0)?.name).toBe("Bronze");
  });

  it("is inclusive at the exact threshold", () => {
    expect(tierForSpend(tiers, 200)?.name).toBe("Silver");
    expect(tierForSpend(tiers, 199.99)?.name).toBe("Bronze");
  });

  it("picks the highest qualifying tier, not just the first one crossed", () => {
    expect(tierForSpend(tiers, 1000)?.name).toBe("Gold");
  });

  it("falls back to the lowest configured tier when spend is negative or tiers are unordered", () => {
    const shuffled = [tiers[2], tiers[0], tiers[1]];
    expect(tierForSpend(shuffled, 600)?.name).toBe("Gold");
    expect(tierForSpend(shuffled, -5)?.name).toBe("Bronze");
  });

  it("returns null when no tiers are configured", () => {
    expect(tierForSpend([], 500)).toBeNull();
  });
});

describe("computeSegment (Rewards Club groups)", () => {
  const winbackDays = 45;
  const g = (visitCount: number, daysSinceLastVisit: number | null) => computeSegment({ visitCount, daysSinceLastVisit, winbackDays });

  it("New: joined, no visits yet", () => {
    expect(g(0, null)).toBe("NEW");
  });
  it("First-time: one visit", () => {
    expect(g(1, 3)).toBe("FIRST_TIME");
  });
  it("Returning: 2–4 visits", () => {
    expect(g(2, 3)).toBe("RETURNING");
    expect(g(4, 30)).toBe("RETURNING");
  });
  it("Regular: 5+ visits, recent", () => {
    expect(g(5, 10)).toBe("REGULAR");
    expect(g(20, 45)).toBe("REGULAR");
  });
  it("Lapsed: nothing in 45+ days — even a regular", () => {
    expect(g(1, 46)).toBe("LAPSED");
    expect(g(20, 46)).toBe("LAPSED");
    expect(g(3, 45)).not.toBe("LAPSED");
  });
});

describe("countVisits", () => {
  it("two bills the same trading night are one visit", () => {
    expect(countVisits([
      { created_at: "2026-10-07T19:00:00Z" }, // Wed 20:00
      { created_at: "2026-10-07T23:30:00Z" }, // Thu 00:30 — still Wednesday
      { created_at: "2026-10-09T12:00:00Z" }, // Fri lunch
    ])).toBe(2);
  });
});
