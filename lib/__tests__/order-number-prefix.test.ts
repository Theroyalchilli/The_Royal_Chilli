jest.mock("../supabase", () => ({
  __esModule: true,
  default: {
    from: () => ({
      select: () => ({
        order: () => ({
          order: () => Promise.resolve({
            data: [
              { id: 1, slug: "royal-chilli" },
              { id: 2, slug: "melt-house" },
              { id: 3, slug: "abcd" },
              { id: 4, slug: "efgh" },
            ],
            error: null,
          }),
        }),
      }),
    }),
  },
}));

import { orderNumberPrefix } from "@/lib/business";

describe("orderNumberPrefix", () => {
  it("gives each business its own order-number prefix", async () => {
    expect(await orderNumberPrefix(1)).toBe("RC"); // unchanged for The Royal Chilli
    expect(await orderNumberPrefix(2)).toBe("MH");
    expect(await orderNumberPrefix(3)).toBe("AB");
    expect(await orderNumberPrefix(4)).toBe("EF");
  });
});
