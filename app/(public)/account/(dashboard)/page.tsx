import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-auth";
import supabase from "@/lib/supabase";
import AccountOrderCard, { type AccountOrder } from "@/components/site/AccountOrderCard";

export default async function AccountHomePage() {
  const session = await getCustomerSession();
  if (!session) return null; // layout already redirects

  const { data: customer } = await supabase.from("customers").select("loyalty_points").eq("id", session.id).maybeSingle();
  const points = customer?.loyalty_points ?? 0;

  const { data: nextReward } = await supabase
    .from("loyalty_rewards")
    .select("name, points_cost")
    .eq("active", 1)
    .gt("points_cost", points)
    .order("points_cost", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: latestOrder } = await supabase
    .from("orders")
    .select("id, order_number, order_type, status, total, scheduled_for, created_at")
    .eq("customer_id", session.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const firstName = session.name.split(" ")[0];

  const quickActions = [
    { href: "/account/loyalty", icon: "🎁", title: "Redeem points", desc: "Turn points into savings" },
    { href: "/account/bookings", icon: "📅", title: "Book a table", desc: "Reserve in seconds" },
    { href: "/account/orders", icon: "🧾", title: "Your orders", desc: "History & pre-orders" },
    { href: "/account/loyalty?tab=voucher", icon: "🎟️", title: "My voucher", desc: "Use points at the till" },
  ];

  return (
    <div>
      <div className="rounded-3xl bg-gradient-to-br from-primary via-primary to-foreground p-5 text-primary-foreground shadow-sm">
        <div className="text-xs text-primary-foreground/70">Welcome back</div>
        <div className="mt-0.5 font-[family-name:var(--font-playfair)] text-2xl">{firstName}</div>
        <div className="mt-3 flex items-end gap-2.5">
          <div className="font-[family-name:var(--font-playfair)] text-4xl leading-none text-amber-200">{points}</div>
          <div className="pb-1 text-sm text-primary-foreground/70">points earned</div>
        </div>
        <div className="mt-2.5 text-xs text-primary-foreground/70">
          {nextReward ? `${nextReward.points_cost - points} points to ${nextReward.name}` : "You've unlocked every reward — redeem any time."}
        </div>
      </div>

      <Link
        href="/order"
        className="mt-3.5 block w-full rounded-xl bg-primary py-3 text-center text-sm font-bold text-primary-foreground hover:opacity-90"
      >
        🍽️ Start a new order
      </Link>

      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        {quickActions.map((a) => (
          <Link key={a.title} href={a.href} className="rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
            <div className="text-lg">{a.icon}</div>
            <div className="mt-1.5 text-sm font-semibold">{a.title}</div>
            <div className="text-[11px] text-muted-foreground">{a.desc}</div>
          </Link>
        ))}
      </div>

      <div className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Latest order</div>
      <div className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
        {latestOrder ? (
          <AccountOrderCard order={latestOrder as AccountOrder} />
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <span className="mb-1.5 block text-2xl">🍽️</span>
            No orders yet. Your first order earns points.
          </div>
        )}
      </div>
    </div>
  );
}
