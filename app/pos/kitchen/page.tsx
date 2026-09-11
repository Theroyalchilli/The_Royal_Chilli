import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import KitchenBoard from "@/components/kitchen/KitchenBoard";
import Link from "next/link";

export default async function KitchenPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="flex-1 overflow-hidden">
        <KitchenBoard />
      </div>
      <div className="bg-surface border-t border-border px-4 py-2 flex gap-3">
        <Link
          href="/pos"
          className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border transition-colors"
        >
          ← Back to POS
        </Link>
        <Link
          href="/pos/reservations"
          className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border transition-colors"
        >
          📅 Reservations
        </Link>
      </div>
    </div>
  );
}
