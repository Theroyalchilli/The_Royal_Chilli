import type { Metadata } from "next";
import { getActiveMenu } from "@/lib/menu";
import OrderMenu from "@/components/site/OrderMenu";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Order Online — The Royal Chilli",
  description: "Order authentic Indian food online for collection or delivery from The Royal Chilli, Hounslow.",
};

export default async function OrderPage() {
  const categories = await getActiveMenu();
  return <OrderMenu categories={categories} />;
}
