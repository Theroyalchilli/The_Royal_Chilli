"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Phone, X } from "lucide-react";
import { siteContent } from "@/lib/site-content";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Kitchen Menu" },
  { href: "/order", label: "Order Online" },
  { href: "/gallery", label: "Gallery" },
  { href: "/reservations", label: "Book a Table" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Two independent things driven by scroll: whether the header has scrolled
  // past the hero (home page only — everywhere else it's always the solid
  // treatment), and whether it should be hidden entirely (every page) —
  // slides away on scroll-down, reappears the moment you scroll up, so it
  // doesn't eat screen space while reading but is never more than one
  // upward flick away.
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 60);
      setHidden(y > lastY && y > 80);
      lastY = y;
    };
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

  const floating = isHome && !scrolled;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,transform] duration-300 ${
          hidden && !menuOpen ? "-translate-y-full" : "translate-y-0"
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
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className={`-mr-1 flex-shrink-0 p-1 md:hidden ${floating ? "text-white" : "text-foreground"}`}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Full-screen mobile menu overlay */}
      <div
        className={`fixed inset-0 z-[60] flex flex-col bg-neutral-950 transition-opacity duration-300 md:hidden ${
          menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <span className="font-[family-name:var(--font-cinzel)] text-sm uppercase tracking-[0.2em] text-white">
            The Royal Chilli
          </span>
          <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="p-1 text-white">
            <X size={24} />
          </button>
        </div>

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
