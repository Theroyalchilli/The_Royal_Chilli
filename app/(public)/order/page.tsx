import type { Metadata } from "next";
import { getActiveMenu } from "@/lib/menu";
import OrderMenu from "@/components/site/OrderMenu";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Order Online — The Royal Chilli",
  description: "Order authentic Indian food online for collection or delivery from The Royal Chilli, Hounslow.",
};

export default async function OrderPage() {
  // "online" channel: website prices, and only items flagged online_available
  // (Breakfast / Lunch Combos / Combos are off the website by that flag).
  const categories = await getActiveMenu("online");
  return <OrderMenu categories={categories} />;
}
