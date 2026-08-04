import { makeLineId } from "@/lib/cart";

describe("makeLineId", () => {
  it("produces the same id regardless of option selection order", () => {
    expect(makeLineId(42, [3, 1, 2])).toBe(makeLineId(42, [1, 2, 3]));
  });

  it("produces different ids for different option selections on the same dish", () => {
    // e.g. "Mild" curry vs "Hot" curry must not merge into one cart line
    const mild = makeLineId(42, [1]);
    const hot = makeLineId(42, [2]);
    expect(mild).not.toBe(hot);
  });

  it("produces different ids for different dishes with identical option ids", () => {
    expect(makeLineId(42, [1])).not.toBe(makeLineId(43, [1]));
  });

  it("handles no modifiers selected", () => {
    expect(makeLineId(42, [])).toBe("42:");
  });
});
