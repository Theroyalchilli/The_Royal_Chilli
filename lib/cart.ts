// Shared cart model for the collection/delivery ordering flow (localStorage-persisted,
// survives navigating from /order to /order/checkout). Dine-in has its own ephemeral
// "send to kitchen" flow in DineInOrder.tsx and doesn't use this.

export type SelectedOption = { id: number; name: string; price_delta: number };

export type CartLine = {
  lineId: string;
  menu_item_id: number;
  name: string;
  unitPrice: number; // base price + sum of selected option deltas
  quantity: number;
  selectedOptions: SelectedOption[];
  notes?: string;
};

const CART_KEY = "rc_cart";

// Two lines are the same if they're the same dish with the exact same modifier
// selections and the exact same special instructions — e.g. "Mild" curry and
// "Hot" curry, or the same curry with different notes, must stay separate.
export function makeLineId(menuItemId: number, optionIds: number[], notes?: string): string {
  return `${menuItemId}:${[...optionIds].sort((a, b) => a - b).join(",")}:${(notes || "").trim()}`;
}

export type OrderType = "takeaway" | "delivery";
const ORDER_TYPE_KEY = "rc_order_type";

export function readOrderType(): OrderType {
  if (typeof window === "undefined") return "takeaway";
  return localStorage.getItem(ORDER_TYPE_KEY) === "delivery" ? "delivery" : "takeaway";
}

export function writeOrderType(type: OrderType) {
  localStorage.setItem(ORDER_TYPE_KEY, type);
}

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

export function writeCart(cart: CartLine[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}
