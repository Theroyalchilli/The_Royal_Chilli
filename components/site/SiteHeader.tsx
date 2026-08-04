"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Phone } from "lucide-react";
import { siteContent } from "@/lib/site-content";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/order", label: "Order Online" },
  { href: "/reservations", label: "Book a Table" },
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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="flex min-w-0 flex-shrink items-center gap-2 sm:gap-3">
          <Image src="/logo.webp" alt="The Royal Chilli" width={40} height={40} className="flex-shrink-0 rounded-full" />
          <span
            className={`truncate font-[family-name:var(--font-cinzel)] text-base tracking-wide sm:text-lg ${
              floating ? "text-white" : "text-primary"
            }`}
          >
            The Royal Chilli
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-normal tracking-wide md:flex">
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
        <a
          href={`tel:${siteContent.contact.phone.replace(/\s/g, "")}`}
          aria-label={`Call ${siteContent.contact.phone}`}
          className="flex flex-shrink-0 items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 sm:px-4"
        >
          <Phone size={16} className="flex-shrink-0" />
          <span className="hidden sm:inline">Call · {siteContent.contact.phone}</span>
        </a>
      </div>
      <nav
        className={`flex items-center gap-4 overflow-x-auto border-t px-4 py-2 text-sm font-normal tracking-wide md:hidden ${
          floating ? "border-transparent" : "border-border"
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
