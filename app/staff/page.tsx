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

// Each module's icon chip gets a tint, cycling through four Royal Chilli-
// family tones instead of one repeated color — mirrors the reference's
// per-tile variety without leaving the brand palette.
const TONE: Record<string, { bg: string; fg: string }> = {
  red:   { bg: "bg-red-600/10",   fg: "text-red-600" },
  amber: { bg: "bg-amber-500/15", fg: "text-amber-700" },
  rose:  { bg: "bg-rose-500/15",  fg: "text-rose-700" },
  stone: { bg: "bg-stone-500/15", fg: "text-stone-600" },
};

// Soft, barely-there two-layer shadow (vs. Tailwind's stock utilities).
const CARD_SHADOW = "shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)]";
const CARD_SHADOW_HOVER = "hover:shadow-[0_2px_4px_rgba(32,27,24,0.05),0_14px_30px_rgba(32,27,24,0.08)]";

const heading = { fontFamily: "var(--font-space-grotesk)" };

export default async function StaffHubPage() {
  const session = await getSession();
  const role = session?.role;
  const see = (tab: Parameters<typeof canAccess>[1]) => (role ? canAccess(role, tab) : false);
  const stats = role ? await getDashboardStats(role) : [];

  // Attendance + rota moved to the dedicated attendance app (royal-chilli-
  // attendance). Set NEXT_PUBLIC_ATTENDANCE_URL to attendance.royalchilli.com later.
  const attendanceUrl = process.env.NEXT_PUBLIC_ATTENDANCE_URL || "https://royal-chilli-attendance.vercel.app";

  const links = [
    { href: "/pos", label: "Go to Till", icon: "🧾", desc: "Take orders and process payments", visible: true, tone: "stone" },
    { href: `${attendanceUrl}/admin`, label: "Attendance & Rota", icon: "🕐", desc: "Clock-ins, timesheets, corrections, rota", visible: see("attendance"), external: true, tone: "red" },
    { href: "/staff/hr", label: "HR Management", icon: "🪪", desc: "Employee records, onboarding, right-to-work, payroll", visible: see("hr"), tone: "amber" },
    { href: "/staff/menu", label: "Menu Management", icon: "🍽️", desc: "Items, prices, allergens, nutrition", visible: see("menu"), tone: "rose" },
    { href: "/staff/tables", label: "Tables", icon: "🪑", desc: "Add tables, set numbers and capacity", visible: see("tables"), tone: "red" },
    { href: "/staff/inventory", label: "Inventory", icon: "📦", desc: "Ingredients, suppliers, recipes", visible: see("inventory"), tone: "stone" },
    { href: "/staff/finance", label: "Finance", icon: "💰", desc: "P&L, VAT, cash reconciliation", visible: see("finance"), tone: "rose" },
    { href: "/staff/analytics", label: "Analytics", icon: "📈", desc: "Sales, menu, staff, inventory trends", visible: see("analytics"), tone: "amber" },
    { href: "/staff/reports", label: "Reports", icon: "📊", desc: "Sales, hours, labour cost, exports", visible: see("reports"), tone: "red" },
    { href: "/staff/audit-log", label: "Audit Log", icon: "🧾", desc: "Who changed what, and when", visible: see("audit"), tone: "stone" },
    { href: "/staff/settings", label: "Settings", icon: "⚙️", desc: "Company, roles & permissions, payroll rules", visible: see("settings"), tone: "stone" },
  ];

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-[1080px]">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 style={heading} className="text-foreground text-[30px] font-semibold leading-tight tracking-[-0.02em]">
              Welcome back, {session?.name}
              {role && (
                <span className="ml-2.5 align-middle rounded-full bg-red-600/10 px-2.5 py-0.5 text-[11.5px] font-semibold tracking-wide text-red-600">
                  {ROLE_LABEL[role] ?? role}
                </span>
              )}
            </h1>
            <p className="mt-1 text-[14.5px] text-muted-foreground">{(role && ROLE_GREETING[role]) ?? "Welcome to Staff Hub."}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pos" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border">
              ← Back to POS
            </Link>
            <LogoutButton />
          </div>
        </div>

        {stats.length > 0 && (
          <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-[13px]">
            {stats.map((s) => (
              <div key={s.label} className={`rounded-[14px] border border-border bg-surface p-[17px] ${CARD_SHADOW}`}>
                <div className="text-[12.5px] text-muted-foreground">{s.label}</div>
                <div style={heading} className="mt-2 text-[27px] font-semibold leading-none tracking-[-0.02em] text-foreground">
                  {s.value}
                </div>
                {s.note && (
                  <div className={`mt-[7px] text-[11.5px] ${s.tone === "warn" ? "text-amber-600" : s.tone === "up" ? "text-red-600" : "text-muted-foreground"}`}>
                    {s.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-8 mb-3 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          Your modules · {links.filter((l) => l.visible).length}
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-[14px]">
          {links.filter((l) => l.visible).map((l) => {
            const tone = TONE[l.tone];
            const cls = `rounded-[14px] border border-border bg-surface p-[18px] text-left transition-all ${CARD_SHADOW} hover:-translate-y-0.5 hover:border-red-200 ${CARD_SHADOW_HOVER}`;
            const body = (
              <>
                <div className={`grid h-10 w-10 place-items-center rounded-[11px] text-[19px] ${tone.bg} ${tone.fg}`}>{l.icon}</div>
                <div style={heading} className="mt-[13px] text-[15.5px] font-semibold text-foreground">
                  {l.label}
                  {l.external && <span className="text-muted-foreground text-xs font-normal"> ↗</span>}
                </div>
                <p className="mt-1 text-[12.5px] leading-[1.45] text-muted-foreground">{l.desc}</p>
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
