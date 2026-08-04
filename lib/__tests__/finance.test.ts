jest.mock("../supabase", () => ({
  __esModule: true,
  default: { from: () => ({ select: () => Promise.resolve({ data: null, error: null }) }) },
}));

import { extractVat } from "@/lib/finance";

describe("extractVat", () => {
  it("extracts VAT from a VAT-inclusive gross amount at the standard 20% rate", () => {
    // gross * rate/(1+rate) = 100 * 0.2/1.2 = 16.666... -> rounds to 16.67
    expect(extractVat(100, 0.2)).toBeCloseTo(16.67, 2);
  });

  it("extracts VAT at the reduced 5% rate", () => {
    // 100 * 0.05/1.05 = 4.7619... -> rounds to 4.76
    expect(extractVat(100, 0.05)).toBeCloseTo(4.76, 2);
  });

  it("returns 0 for a zero-rated item", () => {
    expect(extractVat(100, 0)).toBe(0);
  });

  it("rounds to the nearest penny", () => {
    // 11.45 * 0.2/1.2 = 1.9083... -> rounds to 1.91
    expect(extractVat(11.45, 0.2)).toBeCloseTo(1.91, 2);
  });
});
