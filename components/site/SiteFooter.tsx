import Link from "next/link";
import { siteContent } from "@/lib/site-content";

// Editorial single-column footer, styled after tamarindrestaurant.com's flat
// pastel block with centered serif text and thin dividers — recolored to
// Royal Chilli's own brand hue (a blush tint of --primary) rather than
// their literal salmon, so the pattern is borrowed, not the palette.
function Divider() {
  return <div className="mx-auto my-6 h-px w-10 bg-[#3a0f0c]/25" />;
}

export default function SiteFooter() {
  const { contact, footer } = siteContent;
  return (
    <footer className="bg-[#f6ddd2] text-[#3a0f0c]">
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h3 className="font-[family-name:var(--font-cinzel)] text-lg uppercase tracking-[0.2em]">
          The Royal Chilli
        </h3>
        <p className="mx-auto mt-4 max-w-md text-sm text-[#3a0f0c]/80">{footer.tagline}</p>

        <Divider />

        <p className="text-sm">{contact.address}</p>
        <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="mt-1 inline-block text-sm hover:underline">
          {contact.phone}
        </a>

        <Divider />

        <ul className="space-y-1 text-sm text-[#3a0f0c]/80">
          {contact.hours.map((h) => (
            <li key={h.day}>
              {h.day} &nbsp;·&nbsp; {h.time}
            </li>
          ))}
        </ul>

        <Divider />

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <a
            href={contact.social.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-[#3a0f0c]/40 underline-offset-4 hover:decoration-[#3a0f0c]"
          >
            Instagram
          </a>
          <Link href="/about" className="underline decoration-[#3a0f0c]/40 underline-offset-4 hover:decoration-[#3a0f0c]">
            About
          </Link>
          <Link href="/gallery" className="underline decoration-[#3a0f0c]/40 underline-offset-4 hover:decoration-[#3a0f0c]">
            Gallery
          </Link>
          <Link href="/reservations" className="underline decoration-[#3a0f0c]/40 underline-offset-4 hover:decoration-[#3a0f0c]">
            Reservations
          </Link>
          <Link href="/catering" className="underline decoration-[#3a0f0c]/40 underline-offset-4 hover:decoration-[#3a0f0c]">
            Catering &amp; Events
          </Link>
          <Link href="/careers" className="underline decoration-[#3a0f0c]/40 underline-offset-4 hover:decoration-[#3a0f0c]">
            Careers
          </Link>
        </div>
      </div>
      <div className="border-t border-[#3a0f0c]/15 px-4 py-4 text-center text-xs text-[#3a0f0c]/60">
        <p>{footer.copyright}</p>
        <Link href="/login" className="mt-1 inline-block hover:text-[#3a0f0c]">
          Staff Login
        </Link>
      </div>
    </footer>
  );
}
