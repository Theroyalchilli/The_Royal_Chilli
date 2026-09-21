"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PromoBanner({
  promo,
}: {
  promo: { title: string; description: string | null; link_url: string | null } | null;
}) {
  // Same reasoning as SiteHeader/SiteFooter hiding on /account — that
  // section is a self-contained app shell without extra site chrome.
  const pathname = usePathname();
  if (!promo || pathname?.startsWith("/account")) return null;

  const content = (
    <>
      <span className="font-semibold">{promo.title}</span>
      {promo.description && <span className="text-primary-foreground/85"> — {promo.description}</span>}
    </>
  );

  const className = "block bg-foreground px-4 py-2.5 text-center text-xs text-primary-foreground sm:text-sm";

  if (promo.link_url) {
    return promo.link_url.startsWith("/") ? (
      <Link href={promo.link_url} className={`${className} hover:opacity-90`}>
        {content}
      </Link>
    ) : (
      <a href={promo.link_url} target="_blank" rel="noopener noreferrer" className={`${className} hover:opacity-90`}>
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}
