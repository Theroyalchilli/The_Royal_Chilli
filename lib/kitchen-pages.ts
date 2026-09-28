// Splits the Kitchen Display's Active cards into screen-sized pages, from
// their measured positions (components/kitchen/KitchenBoard.tsx renders a
// hidden copy of the grid to measure). Cards sharing an offsetTop form a grid
// row; rows fill a page until the next wouldn't fit below the page's own top.
// A card too tall for the screen by itself gets its own page, flagged `wide`
// (shown full width with its items in columns, rather than cut off at the
// bottom). The rest of its row carries on as a normal row, sharing a page
// with the rows after it — not a page each (a small 2-item ticket used to
// fill a whole screen just for sitting next to a big table).
export type MeasuredCard = { top: number; height: number };
export type CardPage = { indexes: number[]; wide: boolean };

export function paginateCards(cards: MeasuredCard[], containerHeight: number): CardPage[] {
  const pages: CardPage[] = [];
  let current: number[] = [];
  let pageTop = 0;
  // Height taken out of the layout by tall cards moved to their own pages —
  // rows measured below them sit that much higher once they're gone.
  let lift = 0;
  const flush = () => {
    if (current.length > 0) pages.push({ indexes: current, wide: false });
    current = [];
  };

  let i = 0;
  while (i < cards.length) {
    const measuredTop = cards[i].top;
    const rowTop = measuredTop - lift;
    let j = i;
    let rowBottom = 0;
    while (j < cards.length && cards[j].top === measuredTop) {
      rowBottom = Math.max(rowBottom, rowTop + cards[j].height);
      j++;
    }
    const tall: number[] = [];
    const rest: number[] = [];
    for (let k = i; k < j; k++) (cards[k].height > containerHeight ? tall : rest).push(k);
    if (tall.length > 0) {
      flush();
      for (const k of tall) pages.push({ indexes: [k], wide: true });
      const restHeight = Math.max(0, ...rest.map((k) => cards[k].height));
      lift += rowBottom - rowTop - restHeight;
      rowBottom = rowTop + restHeight;
    }
    if (rest.length > 0) {
      if (current.length > 0 && rowBottom - pageTop > containerHeight) flush();
      if (current.length === 0) pageTop = rowTop;
      current.push(...rest);
    }
    i = j;
  }
  flush();
  return pages;
}
