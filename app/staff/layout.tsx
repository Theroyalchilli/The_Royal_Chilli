import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { canAccess, isStaffManagement, canViewCrm } from "@/lib/permissions";
import StaffShell, { type NavGroup } from "@/components/staff/StaffShell";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = { robots: { index: false } };

// Staff Hub is management-only (manager / hr / admin). Employees work from the
// POS; clock-in/out is the dedicated attendance app's kiosk. Individual pages
// still enforce their own per-tab check.
export default async function StaffHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) redirect("/login");
  if (!isStaffManagement(session.role)) redirect("/pos");

  const see = (tab: Parameters<typeof canAccess>[1]) => canAccess(session.role, tab);

  const nav: NavGroup[] = [
    { label: "Overview", items: [{ href: "/staff", label: "Dashboard", icon: "◧" }] },
    {
      label: "Operations",
      items: [
        { href: "/pos", label: "Go to Till", icon: "🧾" },
        ...(see("tables") ? [{ href: "/staff/tables", label: "Tables", icon: "🪑" }] : []),
        ...(canViewCrm(session.role) ? [{ href: "/staff/customers", label: "Customers & Loyalty", icon: "🎁" }] : []),
        ...(see("menu") ? [{ href: "/staff/menu", label: "Menu", icon: "🍽️" }] : []),
        ...(see("inventory") ? [{ href: "/staff/inventory", label: "Inventory", icon: "📦" }] : []),
      ],
    },
    {
      label: "People",
      items: [
        ...(see("attendance") ? [{ href: "/api/sso/attendance", label: "Attendance & Rota", icon: "🕐" }] : []),
        ...(see("hr") ? [{ href: "/staff/hr", label: "HR Management", icon: "🪪" }] : []),
      ],
    },
    {
      label: "Insights",
      items: [
        ...(see("analytics") ? [{ href: "/staff/analytics", label: "Analytics", icon: "📈" }] : []),
        ...(see("reports") ? [{ href: "/staff/reports", label: "Reports", icon: "📊" }] : []),
        ...(see("finance") ? [{ href: "/staff/finance", label: "Finance", icon: "💰" }] : []),
      ],
    },
    {
      label: "System",
      items: [
        ...(see("audit") ? [{ href: "/staff/audit-log", label: "Audit Log", icon: "🧾" }] : []),
        ...(see("settings") ? [{ href: "/staff/settings", label: "Settings", icon: "⚙️" }] : []),
      ],
    },
  ].filter((g) => g.items.length > 0);

  return (
    <StaffShell user={{ name: session.name, role: session.role }} nav={nav}>
      {children}
      <Toaster />
    </StaffShell>
  );
}
