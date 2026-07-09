import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import KitchenBoard from "@/components/kitchen/KitchenBoard";
import Link from "next/link";

export default async function KitchenPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      <div className="flex-1 overflow-hidden">
        <KitchenBoard />
      </div>
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-2 flex gap-3">
        <Link
          href="/pos"
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold rounded-lg border border-gray-700 transition-colors"
        >
          ← Back to POS
        </Link>
        <Link
          href="/pos/tables"
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold rounded-lg border border-gray-700 transition-colors"
        >
          🍽️ Tables
        </Link>
      </div>
    </div>
  );
}
