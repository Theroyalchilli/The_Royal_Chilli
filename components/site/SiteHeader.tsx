"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Phone } from "lucide-react";
import { siteContent } from "@/lib/site-content";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Kitchen Menu" },
  { href: "/order", label: "Order Online" },
  { href: "/gallery", label: "Gallery" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  // Only the homepage has a full-bleed hero image behind the header — every
  // other page is the site's plain cream background, so a transparent header
  // would be unreadable there. Once scrolled past the hero, fall back to the
  // same solid header everywhere.
  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const floating = isHome && !scrolled;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        floating
          ? "border-b border-transparent bg-transparent"
          : "border-b border-border bg-background/90 backdrop-blur"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4">
        <Link
          href="/"
          className={`flex-shrink-0 truncate font-[family-name:var(--font-cinzel)] text-sm uppercase tracking-[0.2em] sm:text-base ${
            floating ? "text-white" : "text-primary"
          }`}
        >
          The Royal Chilli
        </Link>
        <nav className="hidden items-center gap-8 text-xs uppercase tracking-[0.15em] md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`transition hover:text-primary ${floating ? "text-white/85" : "text-foreground/80"}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-shrink-0 items-center gap-5">
          <a
            href={`tel:${siteContent.contact.phone.replace(/\s/g, "")}`}
            aria-label={`Call ${siteContent.contact.phone}`}
            className={`hidden items-center gap-1.5 text-xs tracking-wide transition hover:text-primary sm:flex ${
              floating ? "text-white/70" : "text-foreground/60"
            }`}
          >
            <Phone size={13} className="flex-shrink-0" />
            {siteContent.contact.phone}
          </a>
          <Link
            href="/reservations"
            className={`text-xs uppercase tracking-[0.15em] transition hover:text-primary ${
              floating ? "text-white" : "text-foreground"
            }`}
          >
            Book a Table
          </Link>
        </div>
      </div>
      <nav
        className={`flex items-center gap-4 overflow-x-auto border-t px-4 py-2 text-xs uppercase tracking-[0.1em] md:hidden ${
          floating ? "border-white/10" : "border-border"
        }`}
      >
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap transition hover:text-primary ${floating ? "text-white/85" : "text-foreground/80"}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
