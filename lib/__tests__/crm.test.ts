jest.mock("../supabase", () => ({
  __esModule: true,
  default: { from: () => ({ select: () => Promise.resolve({ data: null, error: null }) }) },
}));

import { tierForSpend, computeSegment, type LoyaltyTier } from "@/lib/crm";

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

describe("computeSegment", () => {
  const winbackDays = 45;

  it("is NEW for a customer with zero visits, regardless of recency data", () => {
    expect(computeSegment({ visitCount: 0, daysSinceLastVisit: null, lifetimeSpend: 0, winbackDays })).toBe("NEW");
  });

  it("is AT_RISK past the win-back threshold but not yet double it", () => {
    expect(computeSegment({ visitCount: 3, daysSinceLastVisit: 46, lifetimeSpend: 50, winbackDays })).toBe("AT_RISK");
    expect(computeSegment({ visitCount: 3, daysSinceLastVisit: 45, lifetimeSpend: 50, winbackDays })).not.toBe("AT_RISK");
  });

  it("is INACTIVE once recency passes double the win-back threshold", () => {
    expect(computeSegment({ visitCount: 3, daysSinceLastVisit: 91, lifetimeSpend: 50, winbackDays })).toBe("INACTIVE");
  });

  it("recency overrides a high spend/visit count — a lapsed VIP is still AT_RISK, not VIP", () => {
    expect(computeSegment({ visitCount: 20, daysSinceLastVisit: 60, lifetimeSpend: 900, winbackDays })).toBe("AT_RISK");
  });

  it("is VIP for high spend or high visit count within the recency window", () => {
    expect(computeSegment({ visitCount: 2, daysSinceLastVisit: 5, lifetimeSpend: 600, winbackDays })).toBe("VIP");
    expect(computeSegment({ visitCount: 16, daysSinceLastVisit: 5, lifetimeSpend: 50, winbackDays })).toBe("VIP");
  });

  it("is LOYAL for a frequent but lower-spend recent customer", () => {
    expect(computeSegment({ visitCount: 6, daysSinceLastVisit: 5, lifetimeSpend: 100, winbackDays })).toBe("LOYAL");
  });

  it("is ACTIVE for a recent customer who is neither loyal nor VIP yet", () => {
    expect(computeSegment({ visitCount: 2, daysSinceLastVisit: 5, lifetimeSpend: 40, winbackDays })).toBe("ACTIVE");
  });
});
