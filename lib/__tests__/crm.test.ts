jest.mock("../supabase", () => ({
  __esModule: true,
  default: { from: () => ({ select: () => Promise.resolve({ data: null, error: null }) }) },
}));

import { tierForSpend, type LoyaltyTier } from "@/lib/crm";

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
