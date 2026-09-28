// "Sold out" lasts until the next trading day starts (5am UK).
import { isSoldOut, soldOutUntilTomorrow } from "@/lib/sold-out";

describe("sold out", () => {
  it("marked during Monday's service lasts until Tuesday 5am", () => {
    expect(soldOutUntilTomorrow(new Date("2026-09-28T19:00:00Z"))).toBe("2026-09-29T04:00:00.000Z"); // Mon 20:00 BST
  });

  it("marked after midnight still ends at that morning's 5am", () => {
    expect(soldOutUntilTomorrow(new Date("2026-09-29T00:30:00Z"))).toBe("2026-09-29T04:00:00.000Z"); // Tue 01:30 BST
  });

  it("is sold out until then, and available after or when never marked", () => {
    const until = "2026-09-29T04:00:00.000Z";
    expect(isSoldOut({ sold_out_until: until }, new Date("2026-09-29T03:59:00Z"))).toBe(true);
    expect(isSoldOut({ sold_out_until: until }, new Date("2026-09-29T04:00:01Z"))).toBe(false);
    expect(isSoldOut({ sold_out_until: null })).toBe(false);
  });
});
