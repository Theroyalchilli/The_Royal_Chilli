import { cartTotal, lineUnitPrice, makeLineId } from "@/lib/cart";
import { basePriceFor, priceTypeFor } from "@/lib/menu";

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
    expect(makeLineId(42, [])).toBe("42::");
  });
});

describe("collection vs delivery pricing", () => {
  const line = {
    lineId: "1::",
    menu_item_id: 1,
    name: "Chicken Tikka Masala",
    collectionPrice: 8.95,
    deliveryPrice: 10.45,
    unitPrice: 8.95,
    quantity: 2,
    selectedOptions: [{ id: 5, name: "Extra hot", price_delta: 0.5 }],
  };

  it("prices each line by the selected order type, options included", () => {
    expect(lineUnitPrice(line, "takeaway")).toBe(9.45);
    expect(lineUnitPrice(line, "delivery")).toBe(10.95);
    expect(cartTotal([line], "takeaway")).toBe(18.9);
    expect(cartTotal([line], "delivery")).toBe(21.9);
  });

  it("falls back to the price when added for baskets saved before the split", () => {
    const old = { ...line, collectionPrice: undefined, deliveryPrice: undefined, unitPrice: 9.45 };
    expect(lineUnitPrice(old, "delivery")).toBe(9.45);
  });

  it("only delivery orders pay the delivery price, which falls back to the till price", () => {
    expect(priceTypeFor("delivery")).toBe("delivery");
    expect(priceTypeFor("takeaway")).toBe("collection");
    expect(priceTypeFor("dine_in")).toBe("collection");
    expect(basePriceFor({ price: 8.95, online_price: 10.45 }, "delivery")).toBe(10.45);
    expect(basePriceFor({ price: 8.95, online_price: 10.45 }, "collection")).toBe(8.95);
    expect(basePriceFor({ price: 8.95, online_price: null }, "delivery")).toBe(8.95);
  });
});
