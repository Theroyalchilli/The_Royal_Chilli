import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import Reveal from "@/components/site/Reveal";

export const metadata: Metadata = {
  title: "Menus — The Royal Chilli",
  description: "Explore The Royal Chilli's menus — dinner, breakfast, lunch and seasonal promotions of authentic North and South Indian cuisine in Hounslow, London.",
};

// One block per menu type, styled after tamarindrestaurant.com/menus — a
// photo + heading + short blurb + a "View Menu" link that opens the PDF in
// a new tab, rather than an inline viewer. Breakfast, Lunch and Promotions
// don't have PDFs yet, so they render as "Coming Soon" instead of a link;
// flipping one live is just adding a `pdf` field.
type MenuBlock = {
  name: string;
  description: string;
  image: string;
  pdf?: string;
};

const MENUS: MenuBlock[] = [
  {
    name: "Dinner Menu",
    description: "Our full evening menu — tandoori, biryani, curries, breads and more, crafted with the freshest ingredients and spices imported from India.",
    image: "/gallery/Chicken_Dum_Biryani.webp",
    pdf: "/menu-pdf/The_Royal_Chilli_Redesigned_Full_Menu.pdf",
  },
  {
    name: "Breakfast Menu",
    description: "Traditional South Indian breakfast favourites — dosa, idli and more, served fresh every morning.",
    image: "/gallery/Masala_Dosa.webp",
  },
  {
    name: "Lunch Menu",
    description: "A lighter, faster menu built for the midday sitting, without compromising on flavour.",
    image: "/gallery/Salad.webp",
  },
  {
    name: "Drinks Menu",
    description: "Chilled coolers, fresh lassis and soft drinks, poured to cut the heat and carry every dish's spice just right.",
    image: "/gallery/Drinks_Selection.jpg",
  },
  {
    name: "Promotions",
    description: "Seasonal offers, set menus and limited-time specials — announced here first.",
    image: "/gallery/Samosa_Chat.webp",
  },
];

export default function MenuPage() {
  return (
    <div>
      <Reveal className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Our Menus</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-4xl">
          Taste the <span className="italic text-primary">Royal Difference</span>
        </h1>
        <Link
          href="/order"
          className="mt-8 inline-block border border-primary px-8 py-3 text-xs uppercase tracking-[0.15em] text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          Order Online
        </Link>
      </Reveal>

      <div className="mx-auto max-w-5xl px-4 pb-20">
        <div className="grid gap-16">
          {MENUS.map((menu, i) => (
            <Reveal key={menu.name} className="grid items-center gap-8 md:grid-cols-2">
              <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl ${i % 2 === 1 ? "md:order-2" : ""}`}>
                <Image src={menu.image} alt={menu.name} fill className="object-cover" />
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-playfair)] text-2xl">{menu.name}</h2>
                <p className="mt-3 text-muted-foreground">{menu.description}</p>
                {menu.pdf ? (
                  <a
                    href={menu.pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-block border border-primary px-6 py-2.5 text-xs uppercase tracking-[0.15em] text-primary transition hover:bg-primary hover:text-primary-foreground"
                  >
                    View Menu →
                  </a>
                ) : (
                  <span className="mt-6 inline-block border border-border px-6 py-2.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                    Coming Soon
                  </span>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
