const settingValues: Record<string, unknown> = {};

// Rewards rules are each business's own (lib/business-settings.ts).
jest.mock("@/lib/business-settings", () => ({
  getBusinessSetting: async (_bid: number, key: string) => settingValues[key],
  getBusinessNumber: async (_bid: number, key: string, fallback: number) => {
    const n = Number(settingValues[key] ?? fallback);
    return isNaN(n) ? fallback : n;
  },
}));

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

import {
  doublePointsDay,
  generateRedemptionCode,
  getCashCreditInfo,
  isoWeekday,
  nextTradingDayStart,
  notYetValidMessage,
  orderTypesLabel,
  rewardAllowsOrderType,
  rewardDiscount,
} from "@/lib/loyalty";

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
    settingValues.loyalty_max_redeem_per_visit = "10";
    settingValues.loyalty_redeem_step = "5";
  });

  it("is not eligible below the first £5 step", async () => {
    const info = await getCashCreditInfo(1, 499); // £4.99 worth
    expect(info.convertedValue).toBeCloseTo(4.99, 2);
    expect(info.eligible).toBe(false);
    expect(info.options).toEqual([]);
    expect(info.redeemAmount).toBe(0);
    expect(info.redeemPoints).toBe(0);
  });

  it("offers £5 once there's £5 of points", async () => {
    const info = await getCashCreditInfo(1, 750); // £7.50 worth
    expect(info.eligible).toBe(true);
    expect(info.options).toEqual([5]);
    expect(info.redeemAmount).toBe(5);
    expect(info.redeemPoints).toBe(500);
  });

  it("offers £5 or £10, never more than the £10 per-visit cap", async () => {
    const info = await getCashCreditInfo(1, 4200); // £42 worth
    expect(info.options).toEqual([5, 10]);
    expect(info.redeemAmount).toBe(10);
    expect(info.redeemPoints).toBe(1000);
  });

  it("with no step set, the cap is the only amount (old behaviour)", async () => {
    settingValues.loyalty_max_redeem_per_visit = "5";
    delete settingValues.loyalty_redeem_step;
    const info = await getCashCreditInfo(1, 1250);
    expect(info.options).toEqual([5]);
    expect(info.redeemAmount).toBe(5);
  });

  it("falls back to sensible defaults when settings are missing", async () => {
    delete settingValues.loyalty_conversion_points_per_pound;
    delete settingValues.loyalty_max_redeem_per_visit;
    delete settingValues.loyalty_redeem_step;
    const info = await getCashCreditInfo(1, 500);
    expect(info.rate).toBe(100);
    expect(info.cap).toBe(5);
    expect(info.eligible).toBe(true);
  });
});

describe("double points days", () => {
  beforeEach(() => {
    settingValues.loyalty_double_points_days = [2, 3, 4];
  });
  // 2026-10-07 is a Wednesday. BST = UTC+1.
  const uk = (day: number, hour: number) => new Date(Date.UTC(2026, 9, day, hour - 1));

  it("knows its weekdays", () => {
    expect(isoWeekday("2026-10-05")).toBe(1); // Mon
    expect(isoWeekday("2026-10-07")).toBe(3); // Wed
    expect(isoWeekday("2026-10-11")).toBe(7); // Sun
  });

  it("Tue–Thu are double, Mon and Fri aren't", async () => {
    expect(await doublePointsDay(1, uk(5, 19))).toBeNull(); // Mon evening
    expect(await doublePointsDay(1, uk(6, 19))).toBe("Tuesday");
    expect(await doublePointsDay(1, uk(7, 13))).toBe("Wednesday");
    expect(await doublePointsDay(1, uk(8, 21))).toBe("Thursday");
    expect(await doublePointsDay(1, uk(9, 19))).toBeNull(); // Fri
  });

  it("goes by trading day: Thursday night after midnight still counts, Monday night doesn't", async () => {
    expect(await doublePointsDay(1, uk(9, 0.5))).toBe("Thursday"); // Fri 00:30 = Thu trading day
    expect(await doublePointsDay(1, uk(6, 0.5))).toBeNull(); // Tue 00:30 = Mon trading day
  });

  it("no setting → never double", async () => {
    delete settingValues.loyalty_double_points_days;
    expect(await doublePointsDay(1, uk(7, 13))).toBeNull();
  });
});

describe("welcome voucher is for the next visit", () => {
  it("starts at 5am UK the next trading day", () => {
    // joined Wed 7 Oct 20:00 BST → valid from Thu 8 Oct 05:00 BST (04:00 UTC)
    expect(nextTradingDayStart(new Date("2026-10-07T19:00:00Z")).toISOString()).toBe("2026-10-08T04:00:00.000Z");
    // joined Thu 00:30 (still Wednesday's trading day) → same Thursday 05:00
    expect(nextTradingDayStart(new Date("2026-10-07T23:30:00Z")).toISOString()).toBe("2026-10-08T04:00:00.000Z");
  });

  it("the till explains a voucher that isn't valid yet", () => {
    const now = new Date("2026-10-07T19:00:00Z");
    expect(notYetValidMessage("2026-10-08T04:00:00Z", now)).toMatch(/next visit.*Thu 8 Oct/);
    expect(notYetValidMessage("2026-10-07T04:00:00Z", now)).toBeNull();
    expect(notYetValidMessage(null, now)).toBeNull();
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
