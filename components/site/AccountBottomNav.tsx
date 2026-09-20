"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/account", label: "Home", icon: "🏠" },
  { href: "/account/loyalty", label: "Loyalty", icon: "⭐" },
  { href: "/account/orders", label: "Orders", icon: "🧾" },
  { href: "/account/bookings", label: "Bookings", icon: "📅" },
  { href: "/account/profile", label: "Account", icon: "👤" },
];

export default function AccountBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex h-16 max-w-lg border-t border-border bg-background">
      {tabs.map((tab) => {
        const active = tab.href === "/account" ? pathname === "/account" : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
