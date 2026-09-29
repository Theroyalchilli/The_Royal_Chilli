// Kitchen Display screens (components/kitchen/KitchenBoard.tsx). Each table or
// order is one box, side by side, as tall as its items need (a long one
// scrolls inside its own box). How many boxes fit on a screen depends on the
// device's width — a phone shows 1, a tablet 2–3, a laptop 4, a TV more — and
// the rest go on further screens the kitchen moves through with Prev / Next.

export const MIN_BOX_WIDTH = 280; // px — narrowest box that still reads well
export const BOX_GAP = 12; // px

// Boxes per screen for a board this wide (at least 1).
export function boxesPerScreen(width: number, minBox = MIN_BOX_WIDTH, gap = BOX_GAP): number {
  return Math.max(1, Math.floor((width + gap) / (minBox + gap)));
}

// Each box's width: the screen split evenly into that many slots, so boxes
// never stretch to fill the screen when there are only one or two orders.
export function boxWidth(width: number, perScreen: number, gap = BOX_GAP): number {
  return Math.max(0, Math.floor((width - gap * (perScreen - 1)) / perScreen));
}

// The screen (0-based) the box at this position is on.
export function screenOf(index: number, perScreen: number): number {
  return Math.floor(index / perScreen);
}

export function screenCount(boxes: number, perScreen: number): number {
  return Math.max(1, Math.ceil(boxes / perScreen));
}

// The tab for a box in the strip above the boxes: the table ("T7") for dine-in,
// otherwise "Online" (website delivery) or "Collection" (website or till) plus
// the last two digits of the order number, e.g. RC-20260928-023 → "Collection 23".
export function tabLabel(o: { order_type: string; table_number?: string | null; order_number: string }): string {
  if (o.order_type === "dine_in") {
    const t = (o.table_number ?? "").trim();
    if (!t) return "Dine-in";
    return /^\d/.test(t) ? `T${t}` : t;
  }
  const digits = String(o.order_number).replace(/\D/g, "");
  const last2 = digits.slice(-2).padStart(2, "0");
  return `${o.order_type === "delivery" ? "Online" : "Collection"} ${last2}`;
}
