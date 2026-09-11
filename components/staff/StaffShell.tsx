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

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sidebarBody = (
    <div className="flex h-full flex-col overflow-y-auto px-3 py-5">
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-red-600 text-base">🍛</div>
        <div className="min-w-0">
          <p style={{ fontFamily: "var(--font-space-grotesk)" }} className="truncate text-[15px] font-semibold text-white">
            The Royal Chilli
          </p>
          <p className="truncate text-[11px] text-neutral-400">{ROLE_LABEL[user.role] ?? user.role} · full access</p>
        </div>
      </div>

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
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-[252px] flex-shrink-0 bg-foreground md:sticky md:top-0 md:block md:h-screen">{sidebarBody}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/35" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[252px] bg-foreground shadow-xl">{sidebarBody}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex h-[60px] flex-shrink-0 items-center gap-3.5 border-b border-border bg-surface px-4 md:px-6">
          <button
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-lg md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/pos" className="hidden rounded-lg border border-border px-3.5 py-2 text-[12.5px] font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground sm:block">
              ← Back to POS
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="text-right leading-tight">
                <p className="text-[13.5px] font-medium text-foreground">{user.name}</p>
                <p className="text-[11.5px] text-muted-foreground">{ROLE_LABEL[user.role] ?? user.role}</p>
              </div>
              <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-red-600/10 text-[13px] font-semibold text-red-600">
                {initials}
              </div>
            </div>
            <button onClick={handleLogout} className="rounded-lg border border-border px-3 py-2 text-[12.5px] font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground">
              Logout
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
