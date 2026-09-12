import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/staff-dashboard";
import StaffDashboard, { KpiCard } from "@/components/staff/StaffDashboard";

const heading = { fontFamily: "var(--font-space-grotesk)" };

// Restaurant-local time of day, not the server's raw UTC clock — otherwise
// this could say "Good evening" at 2pm during British Summer Time.
function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hour12: false }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function StaffHubPage() {
  const session = await getSession();
  const role = session?.role;
  const data = role ? await getDashboardData(role) : { kpis: [], alerts: [] };
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const firstName = session?.name?.split(" ")[0] ?? session?.name;

  return (
    <div className="px-4 py-6 md:px-6 md:py-7">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-[22px]">
          <h1 style={heading} className="text-foreground text-[27px] font-semibold tracking-[-0.02em]">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-[3px] text-sm text-muted-foreground">{today}</p>
        </div>

        {data.kpis.length > 0 && (
          <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-[14px]">
            {data.kpis.map((s, i) => (
              <KpiCard key={s.label} stat={s} id={i} />
            ))}
          </div>
        )}

        <StaffDashboard data={data} />
      </div>
    </div>
  );
}
