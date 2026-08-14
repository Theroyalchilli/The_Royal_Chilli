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
  { href: "/reservations", label: "Book a Table" },
];

// Bare two-line mark that morphs into an X in place (no icon swap, no
// background box) — styled after tamarindrestaurant.com's own menu toggle,
// confirmed by inspecting their actual markup/CSS rather than guessing:
// `.menu-opener span` is two 1px lines with a margin gap; opening removes
// the gap and rotates each line ±45° so they cross over each other.
function Hamburger({ open, light }: { open: boolean; light: boolean }) {
  const line = light ? "bg-white" : "bg-foreground";
  return (
    <span className="flex w-6 flex-col">
      <span className={`h-px w-full ${line} transition-all duration-300 ${open ? "mb-0 rotate-45" : "mb-[7px]"}`} />
      <span className={`h-px w-full ${line} transition-all duration-300 ${open ? "-mt-px -rotate-45" : ""}`} />
    </span>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [atTop, setAtTop] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  // The full header only ever shows at the very top of the page. Scroll away
  // — either direction — and it's gone for good until you're back at the
  // top; the persistent hamburger below takes over as the only way to reach
  // navigation for the rest of the scroll, on every breakpoint.
  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY <= 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menu on navigation, and lock page scroll while it's open.
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const floating = isHome && atTop;
  // Hide the full header whenever the menu is open too — otherwise its own
  // mobile hamburger (opened while at the top) would sit right on top of
  // the persistent one below.
  const showHeader = atTop && !menuOpen;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,transform,opacity] duration-300 ${
          showHeader ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
        } ${
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
            {navLinks.slice(0, 4).map((link) => (
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
              className={`hidden text-xs uppercase tracking-[0.15em] transition hover:text-primary md:inline ${
                floating ? "text-white" : "text-foreground"
              }`}
            >
              Book a Table
            </Link>
            <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="-mr-1 flex-shrink-0 p-1 md:hidden">
              <Hamburger open={false} light={floating} />
            </button>
          </div>
        </div>
      </header>

      {/* Persistent hamburger — the only way to reach navigation once you've
          scrolled away from the top, on every breakpoint (desktop included).
          Same element opens and closes, morphing into an X, exactly like
          the reference site. */}
      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        className={`fixed right-5 top-6 z-[70] p-1 transition-opacity duration-300 ${
          !atTop || menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <Hamburger open={menuOpen} light={false} />
      </button>

      {/* Full-screen menu overlay */}
      <div
        className={`fixed inset-0 z-[60] flex flex-col bg-neutral-950 transition-opacity duration-300 ${
          menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <nav className="flex flex-1 flex-col items-center justify-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-[family-name:var(--font-cinzel)] text-2xl uppercase tracking-[0.1em] text-white/90 transition hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <a
          href={`tel:${siteContent.contact.phone.replace(/\s/g, "")}`}
          className="flex items-center justify-center gap-2 border-t border-white/10 py-6 text-sm text-white/70"
        >
          <Phone size={14} />
          {siteContent.contact.phone}
        </a>
      </div>
    </>
  );
}
