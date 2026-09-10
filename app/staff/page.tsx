import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { getSession } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";

export default async function StaffHubPage() {
  const session = await getSession();
  const role = session?.role;
  const see = (tab: Parameters<typeof canAccess>[1]) => (role ? canAccess(role, tab) : false);

  // Attendance + rota moved to the dedicated attendance app (royal-chilli-
  // attendance). Set NEXT_PUBLIC_ATTENDANCE_URL to attendance.royalchilli.com later.
  const attendanceUrl = process.env.NEXT_PUBLIC_ATTENDANCE_URL || "https://royal-chilli-attendance.vercel.app";

  const links = [
    { href: `${attendanceUrl}/admin`, label: "Attendance & Rota", icon: "🕐", desc: "Clock-ins, timesheets, corrections, rota", visible: see("attendance"), external: true },
    { href: "/staff/hr", label: "HR Management", icon: "🪪", desc: "Employee records, onboarding, right-to-work, payroll", visible: see("hr") },
    { href: "/staff/menu", label: "Menu Management", icon: "🍽️", desc: "Items, prices, allergens, nutrition", visible: see("menu") },
    { href: "/staff/tables", label: "Tables", icon: "🪑", desc: "Add tables, set numbers and capacity", visible: see("tables") },
    { href: "/staff/inventory", label: "Inventory", icon: "📦", desc: "Ingredients, suppliers, recipes", visible: see("inventory") },
    { href: "/staff/finance", label: "Finance", icon: "💰", desc: "P&L, VAT, cash reconciliation", visible: see("finance") },
    { href: "/staff/analytics", label: "Analytics", icon: "📈", desc: "Sales, menu, staff, inventory trends", visible: see("analytics") },
    { href: "/staff/reports", label: "Reports", icon: "📊", desc: "Hours, labour cost, exports", visible: see("reports") },
    { href: "/staff/audit-log", label: "Audit Log", icon: "🧾", desc: "Who changed what, and when", visible: see("audit") },
    { href: "/staff/settings", label: "Settings", icon: "⚙️", desc: "Company, roles & permissions, payroll rules", visible: see("settings") },
  ];

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground font-bold text-2xl">Staff Hub</h1>
            <p className="text-muted-foreground text-sm mt-1">Welcome, {session?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pos" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border">
              ← Back to POS
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {links.filter((l) => l.visible).map((l) => {
            const cls = "rounded-2xl border border-border bg-surface p-5 hover:border-red-600 transition-colors";
            const body = (
              <>
                <div className="text-3xl">{l.icon}</div>
                <div className="mt-2 text-foreground font-bold">
                  {l.label}
                  {l.external && <span className="text-muted-foreground text-xs font-normal"> ↗</span>}
                </div>
                <div className="text-muted-foreground text-sm mt-1">{l.desc}</div>
              </>
            );
            return l.external ? (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
            ) : (
              <Link key={l.href} href={l.href} className={cls}>{body}</Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
