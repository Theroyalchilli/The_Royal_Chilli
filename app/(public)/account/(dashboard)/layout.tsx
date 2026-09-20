import { redirect } from "next/navigation";
import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-auth";
import LogoutButton from "@/components/site/LogoutButton";

const tabs = [
  { href: "/account", label: "Overview" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/orders", label: "Orders" },
];

// Shared shell for every /account/* page — the one place that guards the
// whole section (redirect if not signed in) so individual pages don't each
// need their own auth check. Addresses/Loyalty/Scan & Pay/Bookings/Support
// land here as more tabs in later phases; only what's actually built shows
// for now rather than linking to stub pages.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");

  return (
    <div className="pb-24">
      <div className="mx-auto max-w-3xl px-4 pt-16 pb-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">My Account</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl">
          Hi, <span className="italic text-primary">{session.name.split(" ")[0]}</span>
        </h1>
      </div>

      <nav className="sticky top-0 z-30 border-y border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-6 px-4 py-3 text-xs uppercase tracking-[0.15em]">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className="text-muted-foreground hover:text-primary">
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-4 pt-8">{children}</div>

      <div className="mx-auto max-w-3xl px-4 pt-10 text-center">
        <LogoutButton />
      </div>
    </div>
  );
}
