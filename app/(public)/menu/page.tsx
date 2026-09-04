import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { siteContent } from "@/lib/site-content";
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
    pdf: "/menu-posters/dinner.jpeg",
  },
  {
    name: "Breakfast Menu",
    description: "Traditional South Indian breakfast favourites — dosa, idli, combo deals and more, served fresh every morning from 8am to 12pm.",
    image: "/gallery/Masala_Wada.webp",
    pdf: "/menu-posters/breakfast.jpeg",
  },
  {
    name: "Lunch Menu",
    description: "Weekday lunch combo deals — wraps, curry boxes, biryani and more, every item £6.95, served 12 noon to 4pm.",
    image: "/gallery/Gobi_65.webp",
    pdf: "/menu-posters/lunch.jpeg",
  },
];

export default function MenuPage() {
  const { foodPhilosophy, signatureExperiences, differentiators } = siteContent;
  const experiences = [signatureExperiences.breakfast, signatureExperiences.lunch, signatureExperiences.dinner];
  const specialities = differentiators.find((d) => d.title === "Signature Specialities");
  const specialitiesText = specialities?.items?.join(" · ") ?? null;

  return (
    <div>
      <Reveal className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Our Menus</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-4xl">
          Taste the <span className="italic text-primary">Royal Difference</span>
        </h1>
        {specialitiesText && (
          <p className="mx-auto mt-4 max-w-xl text-sm uppercase tracking-[0.15em] text-muted-foreground">
            {specialitiesText}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/order"
            className="inline-block border border-primary px-8 py-3 text-xs uppercase tracking-[0.15em] text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            Order Online
          </Link>
          <Link
            href="/catering"
            className="inline-block border border-border px-8 py-3 text-xs uppercase tracking-[0.15em] text-foreground transition hover:border-primary hover:text-primary"
          >
            Catering &amp; Events
          </Link>
        </div>
      </Reveal>

      {/* Food Philosophy */}
      <section className="bg-card px-4 py-16">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Our Food Philosophy</p>
          <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl">{foodPhilosophy.tag}</h2>
          <p className="mt-4 text-muted-foreground">{foodPhilosophy.intro}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {foodPhilosophy.focus.map((f) => (
              <span key={f} className="border border-primary/30 px-3 py-1.5 text-xs uppercase tracking-[0.1em] text-primary">
                {f}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Signature Experiences */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <Reveal className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Signature Experiences</p>
          <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl">
            Royal <span className="italic text-primary">Breakfast, Lunch &amp; Dinner</span>
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {experiences.map((e, i) => (
            <Reveal key={e.title} delay={i * 80} className="text-center">
              <h3 className="font-[family-name:var(--font-playfair)] text-xl text-primary">{e.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{e.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

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
