const settingValues: Record<string, string> = {};

jest.mock("../supabase", () => ({
  __esModule: true,
  default: {
    from: () => ({
      select: () => ({
        eq: (_col: string, key: string) => ({
          maybeSingle: () => Promise.resolve({ data: key in settingValues ? { value: settingValues[key] } : null, error: null }),
        }),
      }),
    }),
  },
}));

import { generateRedemptionCode, getCashCreditInfo, orderTypesLabel, rewardAllowsOrderType, rewardDiscount } from "@/lib/loyalty";

describe("generateRedemptionCode", () => {
  it("avoids visually ambiguous characters (0/O, 1/I/L)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRedemptionCode();
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("defaults to 8 characters and honours a custom length", () => {
    expect(generateRedemptionCode()).toHaveLength(8);
    expect(generateRedemptionCode(5)).toHaveLength(5);
  });

  it("is not deterministic — two calls don't collide in a small sample", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRedemptionCode()));
    expect(codes.size).toBe(50);
  });
});

describe("getCashCreditInfo", () => {
  beforeEach(() => {
    settingValues.loyalty_conversion_points_per_pound = "100";
    settingValues.loyalty_max_redeem_per_visit = "5";
  });

  it("is not eligible below the cap, and reports zero redeemable", async () => {
    const info = await getCashCreditInfo(499); // £4.99 worth
    expect(info.convertedValue).toBeCloseTo(4.99, 2);
    expect(info.eligible).toBe(false);
    expect(info.redeemAmount).toBe(0);
    expect(info.redeemPoints).toBe(0);
  });

  it("is eligible right at the cap", async () => {
    const info = await getCashCreditInfo(500); // exactly £5
    expect(info.eligible).toBe(true);
    expect(info.redeemAmount).toBe(5);
    expect(info.redeemPoints).toBe(500);
  });

  it("caps redemption at one chunk even with a much larger balance", async () => {
    const info = await getCashCreditInfo(1250); // £12.50 worth
    expect(info.convertedValue).toBeCloseTo(12.5, 2);
    expect(info.eligible).toBe(true);
    expect(info.redeemAmount).toBe(5); // still only one £5 chunk
    expect(info.redeemPoints).toBe(500);
  });

  it("respects a configured rate and cap other than the defaults", async () => {
    settingValues.loyalty_conversion_points_per_pound = "200";
    settingValues.loyalty_max_redeem_per_visit = "10";
    const info = await getCashCreditInfo(2000); // 2000/200 = £10
    expect(info.eligible).toBe(true);
    expect(info.redeemAmount).toBe(10);
    expect(info.redeemPoints).toBe(2000);
  });

  it("falls back to sensible defaults when settings are missing", async () => {
    delete settingValues.loyalty_conversion_points_per_pound;
    delete settingValues.loyalty_max_redeem_per_visit;
    const info = await getCashCreditInfo(500);
    expect(info.rate).toBe(100);
    expect(info.cap).toBe(5);
    expect(info.eligible).toBe(true);
  });
});

describe("reward discounts at the till", () => {
  const welcome = { discount_amount: null, discount_pct: 20, max_discount: 20, order_types: ["dine_in"] };

  it("takes 20% of the bill, capped at £20", () => {
    expect(rewardDiscount(welcome, 45.5)).toBe(9.1);
    expect(rewardDiscount(welcome, 100)).toBe(20);
    expect(rewardDiscount(welcome, 250)).toBe(20);
  });

  it("an uncapped percentage keeps going; a £ reward is fixed; neither exceeds the bill", () => {
    expect(rewardDiscount({ ...welcome, max_discount: null }, 250)).toBe(50);
    expect(rewardDiscount({ discount_amount: 5, discount_pct: null, max_discount: null, order_types: null }, 30)).toBe(5);
    expect(rewardDiscount({ discount_amount: 5, discount_pct: null, max_discount: null, order_types: null }, 3.5)).toBe(3.5);
    expect(rewardDiscount({ discount_amount: null, discount_pct: null, max_discount: null, order_types: null }, 30)).toBe(0);
  });

  it("limits the welcome voucher to dine-in; other rewards work on any order", () => {
    expect(rewardAllowsOrderType(welcome, "dine_in")).toBe(true);
    expect(rewardAllowsOrderType(welcome, "takeaway")).toBe(false);
    expect(rewardAllowsOrderType(welcome, "delivery")).toBe(false);
    expect(rewardAllowsOrderType({ ...welcome, order_types: null }, "delivery")).toBe(true);
    expect(orderTypesLabel(["dine_in"])).toBe("dine-in");
  });
});
