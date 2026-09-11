import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { getSession } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { getDashboardStats } from "@/lib/staff-dashboard";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", hr: "HR", manager: "Manager", employee: "Employee" };
const ROLE_GREETING: Record<string, string> = {
  admin: "You have full access. Here's the whole restaurant at a glance.",
  hr: "Your people operations for today.",
  manager: "Front and back of house, right now.",
};

export default async function StaffHubPage() {
  const session = await getSession();
  const role = session?.role;
  const see = (tab: Parameters<typeof canAccess>[1]) => (role ? canAccess(role, tab) : false);
  const stats = role ? await getDashboardStats(role) : [];

  // Attendance + rota moved to the dedicated attendance app (royal-chilli-
  // attendance). Set NEXT_PUBLIC_ATTENDANCE_URL to attendance.royalchilli.com later.
  const attendanceUrl = process.env.NEXT_PUBLIC_ATTENDANCE_URL || "https://royal-chilli-attendance.vercel.app";

  const links = [
    { href: "/pos", label: "Go to Till", icon: "🧾", desc: "Take orders and process payments", visible: true },
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
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-foreground font-semibold text-2xl">
              Welcome back, {session?.name}
              {role && (
                <span className="ml-2 align-middle rounded-full bg-red-600/10 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                  {ROLE_LABEL[role] ?? role}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{(role && ROLE_GREETING[role]) ?? "Welcome to Staff Hub."}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pos" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border">
              ← Back to POS
            </Link>
            <LogoutButton />
          </div>
        </div>

        {stats.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <div className="text-muted-foreground text-xs">{s.label}</div>
                <div className="mt-1.5 text-2xl font-bold text-foreground tracking-tight">{s.value}</div>
                {s.note && (
                  <div className={`mt-1.5 text-xs font-medium ${s.tone === "warn" ? "text-amber-600" : s.tone === "up" ? "text-red-600" : "text-muted-foreground"}`}>
                    {s.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Your modules · {links.filter((l) => l.visible).length}
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {links.filter((l) => l.visible).map((l) => {
            const cls = "rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-600 hover:shadow-md";
            const body = (
              <>
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-red-600/10 text-xl">{l.icon}</div>
                <div className="mt-3 text-foreground font-bold">
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
