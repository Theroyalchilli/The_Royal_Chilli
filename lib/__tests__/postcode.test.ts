import { outwardCode } from "@/lib/postcode";

describe("outwardCode", () => {
  it("splits on the space when the postcode has one", () => {
    expect(outwardCode("TW3 1PA")).toBe("TW3");
    expect(outwardCode("SW1 1AA")).toBe("SW1");
  });

  it("lowercase input is normalized to uppercase", () => {
    expect(outwardCode("tw3 1pa")).toBe("TW3");
  });

  it("collapses extra internal whitespace before splitting", () => {
    expect(outwardCode("TW3   1PA")).toBe("TW3");
  });

  it("trims leading/trailing whitespace", () => {
    expect(outwardCode("  TW3 1PA  ")).toBe("TW3");
  });

  it("falls back to stripping the fixed 3-char inward code when there's no space", () => {
    // "TW31PA" -> inward code is always 3 chars ("1PA") -> outward is "TW3"
    expect(outwardCode("TW31PA")).toBe("TW3");
    expect(outwardCode("SW11AA")).toBe("SW1");
  });

  it("returns the input as-is when it's too short to strip an inward code", () => {
    expect(outwardCode("TW3")).toBe("TW3");
    expect(outwardCode("W1")).toBe("W1");
  });
});
