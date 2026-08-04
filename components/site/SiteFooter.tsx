import Link from "next/link";
import { siteContent } from "@/lib/site-content";

export default function SiteFooter() {
  const { contact, footer } = siteContent;
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
        <div>
          <h3 className="font-[family-name:var(--font-cinzel)] text-lg text-primary">The Royal Chilli</h3>
          <p className="mt-3 text-sm text-muted-foreground">{footer.tagline}</p>
          <a
            href={contact.social.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm text-primary hover:underline"
          >
            Follow us on Instagram
          </a>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Opening Hours</h4>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {contact.hours.map((h) => (
              <li key={h.day} className="flex justify-between gap-4">
                <span>{h.day}</span>
                <span>{h.time}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Contact</h4>
          <p className="mt-3 text-sm text-muted-foreground">{contact.address}</p>
          <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="mt-1 block text-sm text-primary hover:underline">
            {contact.phone}
          </a>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
        <p>{footer.copyright}</p>
        <div className="mt-1 flex items-center justify-center gap-3 opacity-60">
          <Link href="/careers" className="hover:opacity-100">Careers</Link>
          <span>·</span>
          <Link href="/login" className="hover:opacity-100">Staff Login</Link>
        </div>
      </div>
    </footer>
  );
}
