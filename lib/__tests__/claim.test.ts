jest.mock("@/lib/supabase", () => ({ __esModule: true, default: {} }));

import { claimKey, claimKeyValid, claimUrl } from "@/lib/claim";

describe("receipt claim links", () => {
  it("are tied to their order — another order's key doesn't work", () => {
    expect(claimKeyValid(42, claimKey(42))).toBe(true);
    expect(claimKeyValid(43, claimKey(42))).toBe(false);
    expect(claimKeyValid(42, "")).toBe(false);
    expect(claimKeyValid(42, "nonsense")).toBe(false);
  });

  it("are short enough for a small receipt QR", () => {
    expect(claimKey(42)).toHaveLength(12);
    expect(claimUrl(42)).toMatch(/\/claim\?o=42&k=[A-Za-z0-9_-]{12}$/);
  });
});
