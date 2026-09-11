import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/staff-dashboard";
import StaffDashboard from "@/components/staff/StaffDashboard";

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
            {data.kpis.map((s) => (
              <div key={s.label} className="rounded-[14px] border border-border bg-surface p-[17px] shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)]">
                <div className="text-[12.5px] text-muted-foreground">{s.label}</div>
                <div style={heading} className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em] text-foreground">
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

        <StaffDashboard data={data} />
      </div>
    </div>
  );
}
