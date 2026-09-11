"use client";

import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { DashboardData } from "@/lib/staff-dashboard";

const RED = "#DC2626";
const AMBER = "#D97706";
const ROSE = "#E11D48";
const STONE = "#78716C";
const EMERALD = "#059669";
const DONUT_COLORS = [RED, AMBER, ROSE, STONE];
const GRID = "#eef1f0";

const heading = { fontFamily: "var(--font-space-grotesk)" };
const gbp = (n: number) => `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
const SHADOW = "shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)]";

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-[14px] border border-border bg-surface ${SHADOW}`}>
      <div className="flex items-center justify-between px-[18px] pt-4 pb-1">
        <h3 style={heading} className="text-[14.5px] font-semibold text-foreground">{title}</h3>
        {sub && <span className="text-[11.5px] text-muted-foreground">{sub}</span>}
      </div>
      <div className="px-4 pb-[18px] pt-2.5" style={{ height: 260 }}>
        {children}
      </div>
    </div>
  );
}

function ListPanel({ title, sub, empty, children }: { title: string; sub?: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-[14px] border border-border bg-surface ${SHADOW}`}>
      <div className="flex items-center justify-between px-[18px] pt-4 pb-1">
        <h3 style={heading} className="text-[14.5px] font-semibold text-foreground">{title}</h3>
        {sub && <span className="text-[11.5px] text-muted-foreground">{sub}</span>}
      </div>
      <div className="px-[18px] pb-4 pt-2">
        {empty ? <p className="py-6 text-center text-[13px] text-muted-foreground">Nothing here right now.</p> : children}
      </div>
    </div>
  );
}

const RESV_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-red-100 text-red-700",
  seated: "bg-emerald-100 text-emerald-700",
  waitlisted: "bg-stone-100 text-stone-700",
};

export default function StaffDashboard({ data }: { data: DashboardData }) {
  const chartCards: React.ReactNode[] = [];

  // ── Admin: strategic/financial ──────────────────────────────────────────
  if (data.salesTrend) {
    chartCards.push(
      <Panel key="trend" title="Sales trend" sub="Revenue, last 7 days">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.salesTrend}>
            <defs>
              <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RED} stopOpacity={0.18} />
                <stop offset="100%" stopColor={RED} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fill: "#8896a0", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#8896a0", fontSize: 11 }} tickFormatter={gbp} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v: number) => [gbp(v), "Revenue"]} contentStyle={{ borderRadius: 8, border: "1px solid #e3e8e7", fontSize: 12.5 }} />
            <Area type="monotone" dataKey="revenue" stroke={RED} strokeWidth={2} fill="url(#revFill)" dot={{ r: 3, fill: RED }} />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
    );
  }

  if (data.staffCostVsRevenue) {
    chartCards.push(
      <Panel key="cost" title="Staff cost vs revenue" sub="Last 7 days">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.staffCostVsRevenue}>
            <XAxis dataKey="label" tick={{ fill: "#8896a0", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#8896a0", fontSize: 11 }} tickFormatter={gbp} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v: number, name: string) => [gbp(v), name]} contentStyle={{ borderRadius: 8, border: "1px solid #e3e8e7", fontSize: 12.5 }} />
            <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12.5 }} />
            <Bar dataKey="revenue" name="Revenue" fill={RED} radius={[4, 4, 0, 0]} barSize={16} />
            <Bar dataKey="cost" name="Staff cost" fill={AMBER} radius={[4, 4, 0, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    );
  }

  // ── HR: people & compliance ─────────────────────────────────────────────
  if (data.hoursCostTrend) {
    chartCards.push(
      <Panel key="hourscost" title="Hours & labour cost" sub="Last 7 days">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.hoursCostTrend}>
            <XAxis dataKey="label" tick={{ fill: "#8896a0", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="hours" tick={{ fill: "#8896a0", fontSize: 11 }} tickFormatter={(v) => `${v}h`} axisLine={false} tickLine={false} width={38} />
            <YAxis yAxisId="cost" orientation="right" tick={{ fill: "#8896a0", fontSize: 11 }} tickFormatter={gbp} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v: number, name: string) => [name === "Hours" ? `${v}h` : gbp(v), name]} contentStyle={{ borderRadius: 8, border: "1px solid #e3e8e7", fontSize: 12.5 }} />
            <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12.5 }} />
            <Bar yAxisId="hours" dataKey="hours" name="Hours" fill={STONE} radius={[4, 4, 0, 0]} barSize={16} />
            <Line yAxisId="cost" type="monotone" dataKey="cost" name="Labour cost" stroke={AMBER} strokeWidth={2} dot={{ r: 3, fill: AMBER }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>
    );
  }

  if (data.byRole && data.byRole.length > 0) {
    chartCards.push(
      <Panel key="byRole" title="Headcount by role" sub="Active staff">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data.byRole} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={2}>
              {data.byRole.map((_, i) => (
                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12.5 }} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e3e8e7", fontSize: 12.5 }} />
          </PieChart>
        </ResponsiveContainer>
      </Panel>
    );
  }

  // ── Manager: real-time floor ops ────────────────────────────────────────
  if (data.byHour && data.byHour.length > 0) {
    chartCards.push(
      <Panel key="byHour" title="Sales by hour" sub="Today">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.byHour}>
            <XAxis dataKey="hour" tick={{ fill: "#8896a0", fontSize: 10.5 }} interval={1} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#8896a0", fontSize: 11 }} tickFormatter={gbp} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v: number) => [gbp(v), "Revenue"]} contentStyle={{ borderRadius: 8, border: "1px solid #e3e8e7", fontSize: 12.5 }} />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
              {data.byHour.map((h, i) => (
                <Cell key={i} fill={h.revenue > 0 ? RED : GRID} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    );
  }

  const listPanels: React.ReactNode[] = [];

  if (data.onShift) {
    listPanels.push(
      <ListPanel key="onshift" title="On shift right now" sub={`${data.onShift.length} clocked in`} empty={data.onShift.length === 0}>
        {data.onShift.map((p, i) => (
          <div key={i} className="flex items-center justify-between border-b border-[#f0f3f2] py-2.5 last:border-0">
            <span className="text-[13.5px] font-medium text-foreground">{p.name}</span>
            <span className="text-[12px] text-muted-foreground">since {p.since}</span>
          </div>
        ))}
      </ListPanel>
    );
  }

  if (data.reservations) {
    listPanels.push(
      <ListPanel key="resv" title="Today's reservations" sub={`${data.reservations.length} booking${data.reservations.length === 1 ? "" : "s"}`} empty={data.reservations.length === 0}>
        {data.reservations.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-2 border-b border-[#f0f3f2] py-2.5 last:border-0">
            <div className="min-w-0">
              <span className="text-[13.5px] font-medium text-foreground">{r.name}</span>
              <span className="ml-2 text-[12px] text-muted-foreground">{r.time} · {r.partySize} guests</span>
            </div>
            <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${RESV_TONE[r.status] ?? "bg-stone-100 text-stone-700"}`}>{r.status}</span>
          </div>
        ))}
      </ListPanel>
    );
  }

  if (data.topItems && data.topItems.length > 0) {
    listPanels.push(
      <div key="topitems" className={`rounded-[14px] border border-border bg-surface ${SHADOW}`}>
        <div className="flex items-center justify-between px-[18px] pt-4 pb-1">
          <h3 style={heading} className="text-[14.5px] font-semibold text-foreground">Top-selling items</h3>
          <span className="text-[11.5px] text-muted-foreground">By revenue, this week</span>
        </div>
        <div className="px-[18px] pb-4 pt-2">
          {data.topItems.map((it, i) => {
            const max = data.topItems![0].value || 1;
            return (
              <div key={it.name} className="flex items-center gap-3 border-b border-[#f0f3f2] py-2.5 last:border-0">
                <span className="grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-md bg-red-600/10 text-[11px] font-semibold text-red-600">{i + 1}</span>
                <span className="flex-1 truncate text-[13.5px] font-medium text-foreground">{it.name}</span>
                <span className="h-1.5 w-[100px] flex-shrink-0 overflow-hidden rounded-full bg-surface-hover">
                  <span className="block h-full rounded-full bg-red-600" style={{ width: `${Math.round((it.value / max) * 100)}%` }} />
                </span>
                <span className="w-[60px] flex-shrink-0 text-right text-[12.5px] tabular-nums text-muted-foreground">{gbp(it.value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const alertsPanel = (
    <ListPanel key="alerts" title="Needs attention" sub="Live" empty={data.alerts.length === 0}>
      {data.alerts.map((a, i) => (
        <div key={i} className="flex gap-[11px] border-b border-[#f0f3f2] py-[11px] text-[13px] last:border-0">
          <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: a.tone === "rose" ? ROSE : a.tone === "amber" ? AMBER : EMERALD }} />
          <div>
            <div className="text-foreground">{a.text}</div>
            {a.sub && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{a.sub}</div>}
          </div>
        </div>
      ))}
    </ListPanel>
  );

  return (
    <>
      {chartCards.length > 0 && <div className="mb-4 grid gap-4 md:grid-cols-2">{chartCards}</div>}
      {(listPanels.length > 0 || data.alerts.length >= 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {listPanels}
          {alertsPanel}
        </div>
      )}
    </>
  );
}
