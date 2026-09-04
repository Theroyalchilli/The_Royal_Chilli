import Link from "next/link";
import type { Metadata } from "next";
import { siteContent } from "@/lib/site-content";
import Reveal from "@/components/site/Reveal";

export const metadata: Metadata = {
  title: "About Us — The Royal Chilli",
  description: "Our story, mission, vision, principles and values — the heritage and hospitality behind The Royal Chilli in Hounslow, London.",
};

export default function AboutPage() {
  const { ourStory, mission, vision, principles, values, ourPromise } = siteContent;

  return (
    <div>
      <Reveal className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">About Us</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-4xl">
          Our <span className="italic text-primary">Story</span>
        </h1>
      </Reveal>

      {/* Our Story */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <Reveal className="space-y-4">
          {ourStory.paragraphs.map((p, i) => (
            <p key={i} className="text-muted-foreground">{p}</p>
          ))}
        </Reveal>
      </section>

      {/* Mission */}
      <section className="bg-card px-4 py-16">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Our Mission</p>
          <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl">{mission.statement}</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {mission.commitments.map((c) => (
              <span key={c} className="border border-primary/30 px-4 py-2 text-xs uppercase tracking-[0.1em] text-primary">
                {c}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Vision */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Our Vision</p>
          <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl">{vision.statement}</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{vision.text}</p>
        </Reveal>
      </section>

      {/* Principles */}
      <section className="bg-card px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <Reveal className="text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Our Principles</p>
            <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl">
              What We <span className="italic text-primary">Stand On</span>
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {principles.map((p, i) => (
              <Reveal key={p.title} delay={i * 60} className="border border-border bg-background p-6">
                <p className="text-xs uppercase tracking-[0.15em] text-primary">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-2 font-[family-name:var(--font-playfair)] text-lg">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <Reveal className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Our Values</p>
          <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl">
            What We <span className="italic text-primary">Believe</span>
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v, i) => (
            <Reveal key={v.title} delay={i * 50} className="text-center">
              <h3 className="font-[family-name:var(--font-playfair)] text-lg text-primary">{v.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{v.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Our Promise */}
      <section className="bg-card px-4 py-20 text-center">
        <Reveal className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Our Promise</p>
          <h2 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl">{ourPromise.tag}</h2>
          <ul className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-x-6 gap-y-2 text-left text-sm text-muted-foreground">
            {ourPromise.items.map((item) => (
              <li key={item}>✓ {item}</li>
            ))}
          </ul>
          <p className="mx-auto mt-8 max-w-xl text-muted-foreground">{ourPromise.closing}</p>
          <Link
            href="/reservations"
            className="mt-8 inline-block border border-primary px-8 py-3 text-xs uppercase tracking-[0.15em] text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            Book a Table
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
