import type { Metadata } from "next";
import { getActiveMenu } from "@/lib/menu";
import OrderMenu from "@/components/site/OrderMenu";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Order Online — The Royal Chilli",
  description: "Order authentic Indian food online for collection or delivery from The Royal Chilli, Hounslow.",
};

// Breakfast, Lunch Combos and Combos stay as PDF menus only (see /menu) — the
// online order/collection flow only offers the RC_online_order.xlsx dinner
// menu. getActiveMenu() itself stays unfiltered since it's shared with the
// POS till and the dine-in table-ordering page, which do need those categories.
const ONLINE_ORDER_EXCLUDED_CATEGORIES = ["Breakfast", "Lunch Combos", "Combos"];

export default async function OrderPage() {
  const allCategories = await getActiveMenu();
  const categories = allCategories.filter((c) => !ONLINE_ORDER_EXCLUDED_CATEGORIES.includes(c.name));
  return <OrderMenu categories={categories} />;
}
