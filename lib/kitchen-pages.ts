// Splits the Kitchen Display's Active cards into screen-sized pages, from
// their measured positions (components/kitchen/KitchenBoard.tsx renders a
// hidden copy of the grid to measure). Cards sharing an offsetTop form a grid
// row; rows fill a page until the next wouldn't fit below the page's own top.
// A row too tall even alone puts each of its cards on its own page, and a
// card that's too tall by itself is flagged `wide` (shown full width with its
// items in columns, rather than cut off at the bottom).
export type MeasuredCard = { top: number; height: number };
export type CardPage = { indexes: number[]; wide: boolean };

export function paginateCards(cards: MeasuredCard[], containerHeight: number): CardPage[] {
  const pages: CardPage[] = [];
  let current: number[] = [];
  let pageTop = 0;
  const flush = () => {
    if (current.length > 0) pages.push({ indexes: current, wide: false });
    current = [];
  };

  let i = 0;
  while (i < cards.length) {
    const rowTop = cards[i].top;
    let j = i;
    let rowBottom = 0;
    while (j < cards.length && cards[j].top === rowTop) {
      rowBottom = Math.max(rowBottom, cards[j].top + cards[j].height);
      j++;
    }
    if (rowBottom - rowTop > containerHeight) {
      flush();
      for (let k = i; k < j; k++) pages.push({ indexes: [k], wide: cards[k].height > containerHeight });
    } else {
      if (current.length > 0 && rowBottom - pageTop > containerHeight) flush();
      if (current.length === 0) pageTop = rowTop;
      for (let k = i; k < j; k++) current.push(k);
    }
    i = j;
  }
  flush();
  return pages;
}
