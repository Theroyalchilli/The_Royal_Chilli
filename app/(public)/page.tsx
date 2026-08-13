import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { siteContent } from "@/lib/site-content";
import HeroBackground from "@/components/site/HeroBackground";

export const metadata: Metadata = {
  title: "The Royal Chilli — Authentic Indian Cuisine in Hounslow, London",
  description: "Authentic North and South Indian cuisine in the heart of Hounslow, London. Order online for collection or delivery, book a table, or scan the QR code at your table.",
  openGraph: {
    title: "The Royal Chilli — Authentic Indian Cuisine in Hounslow, London",
    description: "Authentic North and South Indian cuisine in the heart of Hounslow, London.",
    images: ["/gallery/Royal_Mixed_Platter.webp"],
  },
};

export default function HomePage() {
  const { hero, about, testimonials, reservation, galleryImages } = siteContent;

  return (
    <div>
      {/* Hero — full-bleed rotating photo, dark-washed for legibility, with
          the restaurant name centered as large tracked-out serif type (the
          "wordmark as hero art" treatment) rather than a marketing headline.
          Pulled up by the layout's header padding so it reaches the true top
          of the page and sits behind the fixed, transparent header; the
          matching top padding keeps content clear of it. */}
      <section className="relative -mt-[108px] flex min-h-[100svh] items-center justify-center overflow-hidden bg-neutral-950 pt-[108px] md:-mt-[72px] md:pt-[72px]">
        <div className="absolute inset-0">
          <HeroBackground images={hero.bgImages} />
          <div className="pointer-events-none absolute inset-0 bg-black/55" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/80 sm:text-sm">{hero.tag}</p>
          <h1 className="mt-5 font-[family-name:var(--font-cinzel)] text-5xl uppercase leading-tight tracking-[0.12em] text-white sm:text-6xl lg:text-7xl">
            The Royal Chilli
          </h1>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/order"
              className="border border-white/50 bg-white/10 px-8 py-3 text-xs uppercase tracking-[0.15em] text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              Order Online
            </Link>
            <Link
              href="/reservations"
              className="border border-white/50 bg-white/10 px-8 py-3 text-xs uppercase tracking-[0.15em] text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              Book a Table
            </Link>
          </div>
        </div>

        <a
          href="#about"
          className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/75 transition hover:text-white"
        >
          Explore Royal Chilli
          <ChevronDown size={16} className="animate-bounce" />
        </a>
      </section>

      {/* About */}
      <section id="about" className="mx-auto max-w-5xl px-4 py-20">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="font-[family-name:var(--font-playfair)] text-3xl font-bold sm:text-4xl">
              {about.title} <span className="italic text-primary">{about.titleGold}</span>
            </h2>
            <p className="mt-5 text-muted-foreground">{about.text1}</p>
            <p className="mt-4 text-muted-foreground">{about.text2}</p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image src={galleryImages[1]} alt="Signature dish" fill className="object-cover" />
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center font-[family-name:var(--font-playfair)] text-3xl font-bold">
          From Our <span className="italic text-primary">Kitchen</span>
        </h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {galleryImages.map((src) => (
            <div key={src} className="relative aspect-square overflow-hidden rounded-xl">
              <Image src={src} alt="" fill className="object-cover transition hover:scale-105" />
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link href="/gallery" className="text-sm font-semibold text-primary hover:underline">See full gallery →</Link>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-card px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-[family-name:var(--font-playfair)] text-3xl font-bold">
            What Our <span className="italic text-primary">Guests Say</span>
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-xl border border-border bg-background p-5">
                <div className="text-primary">{"★".repeat(t.stars)}</div>
                <p className="mt-3 text-sm text-muted-foreground">&ldquo;{t.text}&rdquo;</p>
                <p className="mt-4 text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.platform}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/reviews" className="text-sm font-semibold text-primary hover:underline">See all reviews →</Link>
          </div>
        </div>
      </section>

      {/* Reservation CTA */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{reservation.tag}</p>
        <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl font-bold sm:text-4xl">
          {reservation.title} <span className="italic text-primary">{reservation.titleGold}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{reservation.desc}</p>
        <Link
          href="/reservations"
          className="mt-6 inline-block rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground hover:opacity-90"
        >
          Book Now
        </Link>
      </section>
    </div>
  );
}
