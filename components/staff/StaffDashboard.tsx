"use client";

import { Fragment } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { DashboardData, DashboardStat, SlicePoint } from "@/lib/staff-dashboard";

const RED = "#DC2626";
const AMBER = "#D97706";
const ROSE = "#E11D48";
const STONE = "#78716C";
const EMERALD = "#059669";
const PLUM = "#7C5CBF";
const DONUT_COLORS = [RED, AMBER, ROSE, STONE, PLUM];
const GRID = "#eef1f0";
const TOOLTIP_STYLE = { borderRadius: 10, border: "1px solid #e3e8e7", fontSize: 12.5, boxShadow: "0 8px 24px -8px rgba(32,27,24,0.18)" };

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

// ── KPI card with sparkline + delta badge — used from app/staff/page.tsx ────
export function KpiCard({ stat, id }: { stat: DashboardStat; id: string | number }) {
  const gradId = `kpi-spark-${id}`;
  const toneColor = stat.tone === "warn" ? AMBER : stat.tone === "up" ? RED : STONE;
  return (
    <div className={`rounded-[14px] border border-border bg-surface p-[17px] ${SHADOW}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12.5px] text-muted-foreground">{stat.label}</div>
        {stat.delta && (
          <span
            className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-md px-1.5 py-[3px] text-[10.5px] font-semibold"
            style={{
              color: stat.delta.good === false ? ROSE : stat.delta.good === true ? EMERALD : STONE,
              background: stat.delta.good === false ? "rgba(225,29,72,0.08)" : stat.delta.good === true ? "rgba(5,150,105,0.09)" : "rgba(120,113,108,0.09)",
            }}
          >
            {stat.delta.dir === "up" ? "▲" : "▼"} {Math.abs(stat.delta.pct)}{stat.delta.suffix ?? "%"}
          </span>
        )}
      </div>
      <div style={heading} className="mt-2 text-[27px] font-semibold leading-none tracking-[-0.02em] text-foreground">
        {stat.value}
      </div>
      {stat.note && (
        <div className={`mt-[7px] text-[11.5px] ${stat.tone === "warn" ? "text-amber-600" : stat.tone === "up" ? "text-red-600" : "text-muted-foreground"}`}>
          {stat.note}
        </div>
      )}
      {stat.spark && stat.spark.length > 1 && (
        <div className="mt-2.5" style={{ height: 32 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stat.spark.map((v, i) => ({ v, i }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={toneColor} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={toneColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={toneColor} strokeWidth={1.75} fill={`url(#${gradId})`} dot={false} isAnimationActive />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Ranked bar list — top items, sales by category, etc. ────────────────────
function RankedList({ title, sub, data, formatValue = gbp, color = RED }: { title: string; sub?: string; data: SlicePoint[]; formatValue?: (n: number) => string; color?: string }) {
  const max = data[0]?.value || 1;
  return (
    <div className={`rounded-[14px] border border-border bg-surface ${SHADOW}`}>
      <div className="flex items-center justify-between px-[18px] pt-4 pb-1">
        <h3 style={heading} className="text-[14.5px] font-semibold text-foreground">{title}</h3>
        {sub && <span className="text-[11.5px] text-muted-foreground">{sub}</span>}
      </div>
      <div className="px-[18px] pb-4 pt-2">
        {data.map((it, i) => (
          <div key={it.name} className="flex items-center gap-3 border-b border-[#f0f3f2] py-2.5 last:border-0">
            <span className="grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-md text-[11px] font-semibold" style={{ background: `${color}1a`, color }}>{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">{it.name}</span>
            <span className="h-1.5 w-[100px] flex-shrink-0 overflow-hidden rounded-full bg-surface-hover">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.round((it.value / max) * 100)}%`, background: color, transition: "width 0.8s cubic-bezier(.2,.7,.3,1)" }}
              />
            </span>
            <span className="w-[60px] flex-shrink-0 text-right text-[12.5px] tabular-nums text-muted-foreground">{formatValue(it.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Busiest-times heatmap — day × hour, no chart library needed ─────────────
const WEEKDAY_LABEL: Record<number, string> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun" };

function Heatmap({ cells }: { cells: { weekday: number; hour: number; revenue: number }[] }) {
  const max = Math.max(1, ...cells.map((c) => c.revenue));
  const hours = [...new Set(cells.map((c) => c.hour))].sort((a, b) => a - b);
  const byKey = new Map(cells.map((c) => [`${c.weekday}-${c.hour}`, c.revenue]));

  return (
    <div className={`rounded-[14px] border border-border bg-surface p-[18px] ${SHADOW}`}>
      <div className="flex items-center justify-between pb-3">
        <div>
          <h3 style={heading} className="text-[14.5px] font-semibold text-foreground">Busiest times</h3>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">Revenue by day &amp; hour, averaged over the last 4 weeks</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] gap-[3px]" style={{ gridTemplateColumns: `34px repeat(${hours.length}, 1fr)` }}>
          <div />
          {hours.map((h) => (
            <div key={h} className="text-center text-[9.5px] text-muted-foreground">{h}</div>
          ))}
          {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
            <Fragment key={wd}>
              <div className="flex items-center text-[10.5px] text-muted-foreground">{WEEKDAY_LABEL[wd]}</div>
              {hours.map((h) => {
                const v = byKey.get(`${wd}-${h}`) ?? 0;
                const intensity = v / max;
                return (
                  <div
                    key={`${wd}-${h}`}
                    title={`${WEEKDAY_LABEL[wd]} ${h}:00 — ${gbp(v)}`}
                    className="h-[22px] rounded-[5px] transition-transform hover:scale-110"
                    style={{ background: `rgba(220,38,38,${0.05 + intensity * 0.8})` }}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10.5px] text-muted-foreground">
        Quiet
        {[0.1, 0.35, 0.6, 0.85].map((v) => (
          <span key={v} className="h-2.5 w-4 rounded-sm" style={{ background: `rgba(220,38,38,${0.05 + v * 0.8})` }} />
        ))}
        Slammed
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
  const wideCards: React.ReactNode[] = [];

  // ── Admin: strategic/financial ──────────────────────────────────────────
  if (data.salesTrend) {
    chartCards.push(
      <Panel key="trend" title="Sales trend" sub="Revenue, last 7 days">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.salesTrend}>
            <defs>
              <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RED} stopOpacity={0.22} />
                <stop offset="100%" stopColor={RED} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fill: "#8896a0", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#8896a0", fontSize: 11 }} tickFormatter={gbp} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v: number) => [gbp(v), "Revenue"]} contentStyle={TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="revenue" stroke={RED} strokeWidth={2.25} fill="url(#revFill)" dot={{ r: 3, fill: RED, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
    );
  }

  if (data.weekCompare) {
    chartCards.push(
      <Panel key="weekcompare" title="This week vs last week" sub="Revenue per day">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.weekCompare}>
            <XAxis dataKey="label" tick={{ fill: "#8896a0", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#8896a0", fontSize: 11 }} tickFormatter={gbp} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v: number, name: string) => [gbp(v), name]} contentStyle={TOOLTIP_STYLE} />
            <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12.5 }} />
            <Bar dataKey="lastWeek" name="Last week" fill={PLUM} radius={[4, 4, 0, 0]} barSize={14} isAnimationActive />
            <Bar dataKey="thisWeek" name="This week" fill={RED} radius={[4, 4, 0, 0]} barSize={14} isAnimationActive />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    );
  }

  if (data.channelMix && data.channelMix.length > 0) {
    const total = data.channelMix.reduce((s, c) => s + c.value, 0);
    chartCards.push(
      <Panel key="channelmix" title="Revenue by channel" sub="This week">
        <div className="flex h-full items-center gap-4">
          <div className="h-full w-[48%] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.channelMix} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="88%" paddingAngle={2} isAnimationActive>
                  {data.channelMix.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, name: string) => [gbp(v), name]} contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {data.channelMix.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2 text-[12.5px]">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span className="min-w-0 flex-1 truncate text-foreground">{c.name}</span>
                <span className="tabular-nums text-muted-foreground">{total > 0 ? Math.round((c.value / total) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
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
            <Tooltip formatter={(v: number, name: string) => [gbp(v), name]} contentStyle={TOOLTIP_STYLE} />
            <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12.5 }} />
            <Bar dataKey="revenue" name="Revenue" fill={RED} radius={[4, 4, 0, 0]} barSize={16} isAnimationActive />
            <Bar dataKey="cost" name="Staff cost" fill={AMBER} radius={[4, 4, 0, 0]} barSize={16} isAnimationActive />
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
            <Tooltip formatter={(v: number, name: string) => [name === "Hours" ? `${v}h` : gbp(v), name]} contentStyle={TOOLTIP_STYLE} />
            <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12.5 }} />
            <Bar yAxisId="hours" dataKey="hours" name="Hours" fill={STONE} radius={[4, 4, 0, 0]} barSize={16} isAnimationActive />
            <Line yAxisId="cost" type="monotone" dataKey="cost" name="Labour cost" stroke={AMBER} strokeWidth={2.25} dot={{ r: 3, fill: AMBER, strokeWidth: 0 }} isAnimationActive />
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
            <Pie data={data.byRole} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={2} isAnimationActive>
              {data.byRole.map((_, i) => (
                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12.5 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
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
            <Tooltip formatter={(v: number) => [gbp(v), "Revenue"]} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]} isAnimationActive>
              {data.byHour.map((h, i) => (
                <Cell key={i} fill={h.revenue > 0 ? RED : GRID} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    );
  }

  if (data.heatmap && data.heatmap.length > 0) {
    wideCards.push(<Heatmap key="heatmap" cells={data.heatmap} />);
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
    listPanels.push(<RankedList key="topitems" title="Top-selling items" sub="By revenue, this week" data={data.topItems} color={RED} />);
  }

  if (data.categorySales && data.categorySales.length > 0) {
    listPanels.push(<RankedList key="categorysales" title="Sales by category" sub="This week" data={data.categorySales} color={AMBER} />);
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
      {chartCards.length > 0 && <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">{chartCards}</div>}
      {wideCards.length > 0 && <div className="mb-4 space-y-4">{wideCards}</div>}
      {(listPanels.length > 0 || data.alerts.length >= 0) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {listPanels}
          {alertsPanel}
        </div>
      )}
    </>
  );
}
