import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { canAccess, isStaffManagement, canViewCrm } from "@/lib/permissions";
import { getHubNotifications } from "@/lib/hub-notifications";
import { getBusiness, listBusinesses } from "@/lib/business";
import StaffShell, { type NavGroup } from "@/components/staff/StaffShell";
import { Toaster } from "@/components/ui/toaster";
import NewOrderAlerts from "@/components/pos/NewOrderAlerts";

export const metadata: Metadata = { robots: { index: false } };

// Staff Hub is management-only (manager / hr / admin). Employees work from the
// POS; clock-in/out is the dedicated attendance app's kiosk. The menu only
// lists what the role can open, and each page still enforces its own check.
export default async function StaffHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) redirect("/login");
  if (!isStaffManagement(session.role)) redirect("/pos");

  const see = (tab: Parameters<typeof canAccess>[1]) => canAccess(session.role, tab);

  // First entry = the plain "Dashboard" link; the rest are dropdown groups.
  const nav: NavGroup[] = [
    { label: "", items: [{ href: "/staff", label: "Dashboard", icon: "🏠" }] },
    {
      label: "Operations",
      items: [
        ...(see("menu") ? [{ href: "/staff/menu", label: "Menu", icon: "🍽️" }] : []),
        ...(see("tables") ? [{ href: "/staff/tables", label: "Tables", icon: "🪑" }] : []),
        ...(see("inventory") ? [{ href: "/staff/inventory", label: "Inventory", icon: "📦" }] : []),
        ...(see("finance") ? [{ href: "/staff/platforms", label: "Delivery platforms", icon: "🛵", note: "Enter daily totals" }] : []),
        { href: "/pos", label: "Till", icon: "💷" },
      ],
    },
    {
      label: "People",
      items: [
        ...(see("attendance") ? [{ href: "/api/sso/attendance", label: "Attendance & Rota", icon: "⏱️", external: true }] : []),
        ...(see("hr") ? [{ href: "/staff/hr", label: "HR & Payroll", icon: "👥" }] : []),
        ...(canViewCrm(session.role) ? [{ href: "/staff/customers", label: "Customers & Loyalty", icon: "🎁" }] : []),
      ],
    },
    {
      label: "Insights",
      items: [
        ...(see("analytics") ? [{ href: "/staff/analytics", label: "Analytics", icon: "📈" }] : []),
        ...(see("reports") ? [{ href: "/staff/reports", label: "Reports", icon: "🧾" }] : []),
        ...(see("finance") ? [{ href: "/staff/finance", label: "Finance", icon: "💰" }] : []),
        ...(see("audit") ? [{ href: "/staff/audit-log", label: "Audit log", icon: "🔍" }] : []),
      ],
    },
    {
      label: "Settings",
      items: see("settings")
        ? [
            { href: "/staff/settings", label: "Settings", icon: "⚙️" },
            { href: "/staff/business", label: "Business setup", icon: "🏢", note: "Name, address, VAT, receipts" },
            { href: "/staff/settings?tab=permissions", label: "Roles & Permissions", icon: "🔐" },
          ]
        : [],
    },
  ].filter((g, i) => i === 0 || g.items.length > 0);

  const notices = await getHubNotifications(session.businessId, session.role).catch(() => []);
  const business = await getBusiness(session.businessId);
  // Only the group owner can step into other businesses.
  const switcher = session.owner
    ? (await listBusinesses()).map((b) => ({ id: b.id, name: b.name, active: b.active }))
    : undefined;

  return (
    <StaffShell
      user={{ name: session.name, role: session.role }}
      business={{ id: session.businessId, name: business?.name ?? "The Royal Chilli" }}
      switcher={switcher}
      nav={nav}
      notices={notices}
    >
      {children}
      <NewOrderAlerts />
      <Toaster />
    </StaffShell>
  );
}
