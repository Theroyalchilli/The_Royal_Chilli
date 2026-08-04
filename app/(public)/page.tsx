import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
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
      {/* Hero — pulled up by the layout's header padding so it reaches the
          true top of the page and sits behind the fixed, transparent header. */}
      <section className="relative -mt-[108px] flex min-h-screen items-center justify-center overflow-hidden md:-mt-[72px]">
        <HeroBackground images={hero.bgImages} />
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{hero.tag}</p>
          <h1 className="mt-4 font-[family-name:var(--font-playfair)] text-4xl font-bold italic text-white sm:text-6xl">
            {hero.line1}
            <br />
            <span className="text-primary">{hero.line2}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-white/85">{hero.desc}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/order" className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90">
              Order Online
            </Link>
            <Link href="/reservations" className="rounded-full border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10">
              Reserve a Table
            </Link>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="mx-auto max-w-5xl px-4 py-20">
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
