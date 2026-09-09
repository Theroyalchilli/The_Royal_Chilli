import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Bike, BookOpen, ChevronDown, Clock, MapPin } from "lucide-react";
import { siteContent } from "@/lib/site-content";
import HeroBackground from "@/components/site/HeroBackground";
import Reveal from "@/components/site/Reveal";
import TodayHours from "@/components/site/TodayHours";

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
  const { hero, about, differentiators, testimonials, reservation, galleryImages, popularDishes } = siteContent;

  return (
    <div>
      {/* Hero — full-bleed rotating photo, dark-washed for legibility, with
          the marketing headline as the primary content. The brand mark
          overlays the photo itself (top-left, homepage only) rather than
          living in the shared header — it scrolls away with the hero
          since it's positioned within this section, not fixed to the
          viewport, and isn't a separate bar pushing content down. */}
      <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-neutral-950">
        <div className="absolute inset-0 md:hidden">
          <HeroBackground images={hero.mobileBgImages} />
        </div>
        <div className="absolute inset-0 hidden md:block">
          <HeroBackground images={hero.bgImages} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-black/55" />

        <Link
          href="/"
          className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full bg-background/80 px-3 py-2 shadow-sm backdrop-blur sm:left-6 sm:top-6"
        >
          <span className="font-[family-name:var(--font-cinzel)] text-xs uppercase tracking-[0.15em] text-foreground sm:text-sm">
            The Royal Chilli
          </span>
          <span className="text-base sm:text-lg" aria-hidden="true">🌶️</span>
        </Link>

        <div className="relative z-10 mx-auto w-full max-w-3xl px-6 sm:px-10">
          <h1 className="font-[family-name:var(--font-playfair)] text-5xl font-semibold leading-tight text-white/90 sm:text-6xl lg:text-7xl">
            <span className="block">{hero.headline}</span>
            <span className="block italic text-primary/90">{hero.headlineGold}</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm text-white/80 sm:text-base">{hero.description}</p>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/reservations"
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground shadow-lg transition hover:opacity-90"
            >
              Book a Table <ArrowRight size={16} />
            </Link>
            <div className="flex w-full gap-3 sm:w-auto">
              <Link
                href="/order"
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/50 px-5 py-3.5 text-xs uppercase tracking-[0.15em] text-white backdrop-blur-sm transition hover:bg-white/20 sm:flex-none"
              >
                <Bike size={16} /> Order Online
              </Link>
              <Link
                href="/menu"
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/50 px-5 py-3.5 text-xs uppercase tracking-[0.15em] text-white backdrop-blur-sm transition hover:bg-white/20 sm:flex-none"
              >
                <BookOpen size={16} /> View Menu
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/80">
            <a
              href={siteContent.contact.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-white hover:underline"
            >
              <MapPin size={14} /> Located in Hounslow
            </a>
            <span className="text-white/30">|</span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} /> Open today: <TodayHours />
            </span>
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

      {/* Most Popular Dishes */}
      <section className="mx-auto max-w-5xl px-4 pb-12 pt-24">
        <Reveal className="text-center">
          <h2 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl">
            {popularDishes.title}
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-muted-foreground">{popularDishes.story}</p>
        </Reveal>
        <Reveal delay={100} className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {popularDishes.images.map((src) => (
            <div key={src} className="relative aspect-[4/5] overflow-hidden rounded-xl bg-neutral-950">
              <Image src={src} alt="" fill className="object-contain transition hover:scale-105" />
            </div>
          ))}
        </Reveal>
      </section>

      {/* About */}
      <section id="about" className="mx-auto max-w-5xl px-4 pb-12 pt-24">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Our Story</p>
            <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl">
              {about.title} <span className="italic text-primary">{about.titleGold}</span>
            </h2>
            <p className="mt-6 text-muted-foreground">{about.text1}</p>
            <p className="mt-4 text-muted-foreground">{about.text2}</p>
            <Link href="/about" className="mt-6 inline-block text-xs uppercase tracking-[0.15em] text-primary hover:underline">
              Read More →
            </Link>
          </Reveal>
          <Reveal delay={150} className="relative aspect-square overflow-hidden rounded-2xl">
            <Image src="/gallery/Tandoori_Sizzler.webp" alt="Tandoori Sizzler" fill className="object-cover" />
          </Reveal>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="bg-card px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <Reveal className="text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Why Royal Chilli</p>
            <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl">
              What Makes Us <span className="italic text-primary">Different</span>
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {differentiators.map((d, i) => (
              <Reveal key={d.title} delay={i * 60} className="border border-border bg-background p-6">
                <h3 className="font-[family-name:var(--font-playfair)] text-lg">{d.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d.items?.join(" · ") ?? d.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-8">
        <Reveal className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Gallery</p>
          <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl">
            From Our <span className="italic text-primary">Kitchen</span>
          </h2>
        </Reveal>
        <Reveal delay={100} className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {galleryImages.map((src) => (
            <div key={src} className="relative aspect-square overflow-hidden rounded-xl">
              <Image src={src} alt="" fill className="object-cover transition hover:scale-105" />
            </div>
          ))}
        </Reveal>
        <div className="mt-8 text-center">
          <Link href="/gallery" className="text-xs uppercase tracking-[0.15em] text-primary hover:underline">
            See Full Gallery
          </Link>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-card px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <Reveal className="text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Reviews</p>
            <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl">
              What Our <span className="italic text-primary">Guests Say</span>
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 80} className="border border-border bg-background p-6 text-center">
                <div className="text-primary">{"★".repeat(t.stars)}</div>
                <p className="mt-4 text-sm text-muted-foreground">&ldquo;{t.text}&rdquo;</p>
                <div className="mx-auto mt-5 h-px w-8 bg-primary/30" />
                <p className="mt-5 text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.platform}</p>
              </Reveal>
            ))}
          </div>
          <div className="mt-8 text-center">
            <a
              href={siteContent.contact.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs uppercase tracking-[0.15em] text-primary hover:underline"
            >
              See All Reviews
            </a>
          </div>
        </div>
      </section>

      {/* Reservation CTA */}
      <section className="mx-auto max-w-3xl px-4 py-24 text-center">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">{reservation.tag}</p>
          <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl">
            {reservation.title} <span className="italic text-primary">{reservation.titleGold}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{reservation.desc}</p>
          <Link
            href="/reservations"
            className="mt-8 inline-block border border-primary px-8 py-3 text-xs uppercase tracking-[0.15em] text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            Book Now
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
