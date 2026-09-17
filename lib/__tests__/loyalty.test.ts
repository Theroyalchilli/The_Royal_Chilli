import { generateRedemptionCode } from "@/lib/loyalty";

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
