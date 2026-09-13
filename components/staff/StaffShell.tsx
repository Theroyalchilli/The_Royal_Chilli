"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type NavItem = { href: string; label: string; icon: string; external?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

const ROLE_LABEL: Record<string, string> = { admin: "Admin", hr: "HR", manager: "Manager", employee: "Employee" };

export default function StaffShell({
  user,
  nav,
  children,
}: {
  user: { name: string; role: string };
  nav: NavGroup[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const active = (href: string) =>
    href === "/staff" ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const sidebarBody = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-3 pb-5 pt-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="The Royal Chilli" className="h-9 w-9 flex-shrink-0 rounded-lg object-cover" />
        <div className="min-w-0">
          <p style={{ fontFamily: "var(--font-cinzel)" }} className="truncate text-[13px] font-bold leading-none tracking-wide text-white">
            The Royal Chilli
          </p>
          <p style={{ fontFamily: "var(--font-playfair)" }} className="mt-1 truncate text-[10.5px] font-bold italic leading-none tracking-widest text-yellow-500">
            Dil Se Desi
          </p>
          <p className="mt-1.5 truncate text-[11px] text-neutral-400">{user.name} · {ROLE_LABEL[user.role] ?? user.role}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        {nav.map((group, gi) => (
          <div key={gi} className="mb-4">
            <h4 className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{group.label}</h4>
            {group.items.map((item) => {
              const isActive = !item.external && active(item.href);
              const cls = `mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors ${
                isActive ? "bg-red-600 font-medium text-white" : "text-neutral-300 hover:bg-white/10 hover:text-white"
              }`;
              return item.external ? (
                <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => setOpen(false)}>
                  <span className="w-[18px] text-center text-sm">{item.icon}</span>
                  {item.label}
                  <span className="ml-auto text-[11px] opacity-60">↗</span>
                </a>
              ) : (
                <Link key={item.href} href={item.href} className={cls} onClick={() => setOpen(false)}>
                  <span className="w-[18px] text-center text-sm">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span className="w-[18px] text-center text-sm">↩</span>
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background" style={{ fontFamily: "var(--font-space-grotesk)" }}>
      {/* Desktop sidebar — never printed, so a printed report isn't cluttered with nav chrome */}
      <aside className="hidden w-[252px] flex-shrink-0 bg-foreground md:sticky md:top-0 md:block md:h-screen print:hidden">{sidebarBody}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/35" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[252px] bg-foreground shadow-xl">{sidebarBody}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-only top bar — just the menu toggle; identity/logout live in the sidebar */}
        <div className="sticky top-0 z-20 flex h-[52px] flex-shrink-0 items-center border-b border-border bg-surface px-4 md:hidden print:hidden">
          <button
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-lg"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
