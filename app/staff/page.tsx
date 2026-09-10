import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { getSession } from "@/lib/auth";
import { canManageStaff, canManageInventory, canViewCrm, canManageDrivers, canManageFinance } from "@/lib/permissions";

export default async function StaffHubPage() {
  const session = await getSession();
  const isManager = session ? canManageStaff(session.role) : false;
  const isInventoryManager = session ? canManageInventory(session.role) : false;
  const canSeeCrm = session ? canViewCrm(session.role) : false;
  const canSeeDrivers = session ? canManageDrivers(session.role) || session.role === "driver" : false;
  const canSeeFinance = session ? canManageFinance(session.role) : false;

  // Attendance + rota moved to the dedicated attendance app (royal-chilli-
  // attendance). Phase 8: point NEXT_PUBLIC_ATTENDANCE_URL at attendance.royalchilli.com.
  const attendanceUrl = process.env.NEXT_PUBLIC_ATTENDANCE_URL || "https://royal-chilli-attendance.vercel.app";

  const links = [
    { href: `${attendanceUrl}/admin`, label: "Attendance & Rota", icon: "🕐", desc: "Clock-ins, timesheets, corrections, rota", visible: isManager, external: true },
    { href: "/staff/hr", label: "HR", icon: "🪪", desc: "Employee directory, onboarding, right-to-work, new-starter checklist", visible: isManager },
    { href: "/staff/menu", label: "Menu Management", icon: "🍽️", desc: "Items, prices, allergens, nutrition", visible: isManager },
    { href: "/staff/tables", label: "Tables", icon: "🪑", desc: "Add tables, set numbers and capacity", visible: isManager },
    { href: "/staff/payroll", label: "Payroll", icon: "💷", desc: "Pay periods, payslips, payments", visible: isManager },
    { href: "/staff/inventory", label: "Inventory", icon: "📦", desc: "Ingredients, suppliers, recipes", visible: isInventoryManager },
    { href: "/staff/customers", label: "Customers & Loyalty", icon: "❤️", desc: "CRM, points, rewards", visible: canSeeCrm },
    { href: "/staff/drivers", label: "Drivers", icon: "🚗", desc: "Assign deliveries, track status", visible: canSeeDrivers },
    { href: "/staff/finance", label: "Finance", icon: "💰", desc: "P&L, VAT, cash reconciliation", visible: canSeeFinance },
    { href: "/staff/analytics", label: "Analytics", icon: "📈", desc: "Sales, menu, staff, inventory trends", visible: isManager },
    { href: "/staff/reports", label: "Reports", icon: "📊", desc: "Hours, labour cost, exports", visible: isManager },
    { href: "/staff/audit-log", label: "Audit Log", icon: "🧾", desc: "Who changed what, and when", visible: isManager },
    { href: "/staff/settings", label: "Settings", icon: "⚙️", desc: "Company, currency, payroll rules", visible: isManager },
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
