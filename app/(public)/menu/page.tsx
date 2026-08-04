import Link from "next/link";
import type { Metadata } from "next";
import { getActiveMenu } from "@/lib/menu";
import MenuBrowser from "@/components/site/MenuBrowser";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Menu — The Royal Chilli",
  description: "Browse our full menu of authentic North and South Indian dishes — tandoori, biryani, curries, breads, and more. Order online for collection or delivery.",
};

export default async function MenuPage() {
  const categories = await getActiveMenu();

  return (
    <div>
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Our Menu</p>
        <h1 className="mt-2 font-[family-name:var(--font-playfair)] text-4xl font-bold">
          Taste the <span className="italic text-primary">Royal Difference</span>
        </h1>
        <Link
          href="/order"
          className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
        >
          Order Online
        </Link>
      </div>

      <MenuBrowser categories={categories} />
    </div>
  );
}
