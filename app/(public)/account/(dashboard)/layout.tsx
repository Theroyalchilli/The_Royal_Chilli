import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import supabase from "@/lib/supabase";
import AccountBottomNav from "@/components/site/AccountBottomNav";

// Shared shell for every /account/* dashboard page — topbar with a live
// points chip, the page content, and the fixed bottom tab bar. SiteHeader's
// hamburger and SiteFooter both hide themselves on this path (see their own
// files) so this reads as a self-contained app, not the rest of the site
// with extra chrome bolted on.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");

  const { data: customer } = await supabase.from("customers").select("loyalty_points").eq("id", session.id).maybeSingle();

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-20 flex items-center justify-between bg-primary px-5 py-3.5 text-primary-foreground shadow-sm">
        <div>
          <div className="font-[family-name:var(--font-playfair)] text-lg leading-tight">The Royal Chilli</div>
          <div className="text-[11px] text-primary-foreground/70">Kingsley Road · Hounslow</div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1.5">
          <span className="text-sm font-bold text-amber-100">{customer?.loyalty_points ?? 0}</span>
          <span className="text-[11px] text-amber-100/80">points</span>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-6">{children}</div>

      <AccountBottomNav />
    </div>
  );
}
