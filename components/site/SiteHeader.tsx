"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";
import { siteContent } from "@/lib/site-content";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menus" },
  { href: "/order", label: "Order Online" },
  { href: "/gallery", label: "Gallery" },
  { href: "/reservations", label: "Book a Table" },
  { href: "/about", label: "About" },
  { href: "/catering", label: "Catering & Events" },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/account/me")
      .then((r) => setLoggedIn(r.ok))
      .catch(() => setLoggedIn(false));
  }, [pathname]);

  // Close the menu on navigation, and lock page scroll while it's open.
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // The wash itself has no blur (confirmed on the reference site) — the
  // page content behind it is what's blurred, applied directly to <main>
  // and <footer> (siblings of this overlay, not blurred ancestors of it) so
  // the menu text stays crisp. Blurring both means the whole background is
  // consistently soft even if the menu's opened scrolled near the bottom of
  // a page, where <main> alone would leave the footer sharp. Same 20px /
  // 0.8s easing as the reference's #content.
  useEffect(() => {
    const targets = [document.querySelector("main"), document.querySelector("footer")].filter(
      (el): el is HTMLElement => el !== null
    );
    for (const el of targets) {
      el.style.transition = "filter 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)";
      el.style.filter = menuOpen ? "blur(20px)" : "";
    }
    return () => { for (const el of targets) el.style.filter = ""; };
  }, [menuOpen]);

  return (
    <>
      {/* Sole nav trigger now — the old top bar (Home/Menus/Order Online/
          Gallery links, phone number, Book a Table) was removed entirely.
          Always visible, on every breakpoint; opens the full-screen overlay
          below, which still carries every link plus the phone number. A
          background chip keeps it readable over the homepage's dark hero
          photo as well as every other page's light background, without
          needing to track scroll position for contrast. */}
      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        className="fixed right-5 top-5 z-[70] rounded-full bg-background/80 p-2.5 shadow-sm backdrop-blur"
      >
        <Hamburger open={menuOpen} light={false} />
      </button>

      {/* Full-screen menu overlay — a flat 50% white wash with no blur, black
          text, plain case: the reference site's actual treatment (confirmed
          via their live CSS), not the solid-dark version guessed earlier. */}
      <div
        className={`fixed inset-0 z-[60] flex flex-col bg-white/50 transition-opacity duration-300 ${
          menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <nav className="flex flex-1 flex-col items-center justify-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="font-[family-name:var(--font-playfair)] text-2xl text-foreground transition hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={loggedIn ? "/account" : "/account/login"}
            onClick={() => setMenuOpen(false)}
            className="font-[family-name:var(--font-playfair)] text-2xl text-foreground transition hover:text-primary"
          >
            {loggedIn ? "My Account" : "Sign In"}
          </Link>
        </nav>

        <a
          href={`tel:${siteContent.contact.phone.replace(/\s/g, "")}`}
          className="flex items-center justify-center gap-2 border-t border-black/10 pt-6 text-sm text-foreground/70"
        >
          <Phone size={14} />
          {siteContent.contact.phone}
        </a>
        <a
          href={`https://wa.me/${siteContent.contact.waNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 pb-6 pt-3 text-sm text-foreground/70"
        >
          <MessageCircle size={14} />
          WhatsApp: {siteContent.contact.waDisplay}
        </a>
      </div>
    </>
  );
}
