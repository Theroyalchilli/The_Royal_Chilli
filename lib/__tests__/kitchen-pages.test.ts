// Kitchen Display paging, from measured card positions (px).
import { paginateCards } from "@/lib/kitchen-pages";

const card = (top: number, height: number) => ({ top, height });

describe("paginateCards", () => {
  it("fits whole rows on a page and moves the next row to a new page", () => {
    // Two rows of two cards, 300px each + gap, in a 500px screen.
    const cards = [card(0, 300), card(0, 250), card(316, 300), card(316, 200)];
    expect(paginateCards(cards, 500)).toEqual([
      { indexes: [0, 1], wide: false },
      { indexes: [2, 3], wide: false },
    ]);
  });

  it("measures later pages from their own top (was: one row per page after page 1)", () => {
    // Four short rows (200px), a 500px screen holds two per page.
    const cards = [card(0, 200), card(216, 200), card(432, 200), card(648, 200)];
    expect(paginateCards(cards, 500)).toEqual([
      { indexes: [0, 1], wide: false },
      { indexes: [2, 3], wide: false },
    ]);
  });

  it("gives an order taller than the screen its own wide page instead of cutting it off", () => {
    const cards = [card(0, 200), card(216, 1400), card(216, 300), card(1632, 200)];
    expect(paginateCards(cards, 500)).toEqual([
      { indexes: [0], wide: false },
      { indexes: [1], wide: true },
      { indexes: [2], wide: false },
      { indexes: [3], wide: false },
    ]);
  });

  it("keeps everything on one page when it fits", () => {
    expect(paginateCards([card(0, 100), card(0, 120)], 500)).toEqual([{ indexes: [0, 1], wide: false }]);
    expect(paginateCards([], 500)).toEqual([]);
  });
});
