"use client";

import { cn, TABLE_ATTENTION_MINUTES, minutesSince, tableElapsedLabel } from "@/lib/utils";
import type { RestaurantTable } from "@/lib/types";

interface Props {
  tables: RestaurantTable[];
  selectedTable: number | null;
  onSelect: (table: RestaurantTable) => void;
  // Reservations aren't linked to a specific table until they're seated, so
  // there's no individual table to flag "Reserved" ahead of time — this is a
  // plain count of today's bookings coming up soon instead (see /api/tables).
  upcomingReservationCount: number;
}

// Fills a grid column-by-column instead of row-by-row, each column
// top-to-bottom highest-to-lowest — e.g. 9 items over 3 columns reads
// 3,6,9 / 2,5,8 / 1,4,7 rather than the plain ascending 1,2,3 / 4,5,6 / 7,8,9.
function columnMajor<T>(items: T[], cols: number): T[] {
  const rows = Math.ceil(items.length / cols);
  const columns = Array.from({ length: cols }, (_, c) => items.slice(c * rows, c * rows + rows).reverse());
  const flat: T[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (columns[c][r] !== undefined) flat.push(columns[c][r]);
    }
  }
  return flat;
}

export default function TableGrid({ tables, selectedTable, onSelect, upcomingReservationCount }: Props) {
  // Single floor, no location zones — tables are laid out purely by table
  // number: the first 9 as a 3x3 block (column-major, matching the
  // restaurant's physical layout), the rest as a 4-wide row beneath it.
  const sorted = [...tables].sort(
    (a, b) => parseInt(a.table_number.replace(/\D/g, ""), 10) - parseInt(b.table_number.replace(/\D/g, ""), 10)
  );
  const groups = [
    { cols: 3, tables: columnMajor(sorted.slice(0, 9), 3) },
    { cols: 4, tables: sorted.slice(9) },
  ].filter(g => g.tables.length > 0);

  const stats = {
    free:     tables.filter(t => t.status === "available").length,
    occupied: tables.filter(t => t.status === "occupied").length,
    reserved: upcomingReservationCount,
  };

  return (
    <div className="space-y-4">

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Free",     count: stats.free,     color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/30" },
          { label: "Occupied", count: stats.occupied, color: "text-red-600",     bg: "bg-red-500/10 border-red-500/30" },
          { label: "Upcoming", count: stats.reserved, color: "text-amber-600",   bg: "bg-amber-500/10 border-amber-500/30", title: "Reservations booked for the next 90 minutes — no specific table yet, that's assigned when they're seated" },
        ].map(s => (
          <div key={s.label} title={"title" in s ? s.title : undefined} className={`rounded-xl border px-3 py-2 text-center ${s.bg}`}>
            <div className={`text-xl font-black ${s.color}`}>{s.count}</div>
            <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table groups */}
      {groups.map((group, i) => {
        return (
          <div key={i}>
            <div className={cn("grid gap-2", group.cols === 3 ? "grid-cols-3" : "grid-cols-4")}>
              {group.tables.map(table => {
                const isSelected = selectedTable === table.id;
                const status = table.status as "available" | "occupied" | "reserved";
                const elapsedMins = table.occupied_since ? minutesSince(table.occupied_since) : null;
                const needsAttention = status === "occupied" && elapsedMins !== null && elapsedMins >= TABLE_ATTENTION_MINUTES;

                const statusCfg = {
                  available: {
                    card:   "bg-surface border-border hover:border-emerald-500/50 hover:bg-surface-hover",
                    stripe: "bg-emerald-500",
                    num:    "text-foreground",
                    label:  "text-emerald-600",
                    text:   "Free",
                  },
                  occupied: {
                    card:   "bg-red-50 border-red-200 hover:border-red-400",
                    stripe: "bg-red-500",
                    num:    "text-red-700",
                    label:  "text-red-600",
                    text:   "Busy",
                  },
                  reserved: {
                    card:   "bg-amber-50 border-amber-200 hover:border-amber-400",
                    stripe: "bg-amber-500",
                    num:    "text-amber-700",
                    label:  "text-amber-600",
                    text:   "Rsv",
                  },
                  attention: {
                    card:   "bg-orange-100 border-orange-400 hover:border-orange-500",
                    stripe: "bg-orange-600",
                    num:    "text-orange-800",
                    label:  "text-orange-700",
                    text:   "Attention",
                  },
                }[needsAttention ? "attention" : status];

                return (
                  <button
                    key={table.id}
                    onClick={() => onSelect(table)}
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded-xl border overflow-hidden",
                      "h-[72px] transition-all duration-150 no-select pos-btn",
                      isSelected
                        ? "border-blue-400 bg-blue-50 ring-2 ring-blue-400/40 ring-offset-1 ring-offset-background"
                        : statusCfg.card
                    )}
                  >
                    {/* Top colour stripe */}
                    <div className={cn(
                      "absolute top-0 left-0 right-0 h-[3px]",
                      isSelected ? "bg-blue-400" : statusCfg.stripe
                    )} />

                    {/* Pulsing dot for occupied / attention */}
                    {status === "occupied" && !isSelected && (
                      <div className="absolute top-2 right-2">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-60", needsAttention ? "bg-orange-400" : "bg-red-400")} />
                          <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", needsAttention ? "bg-orange-600" : "bg-red-500")} />
                        </span>
                      </div>
                    )}
                    {needsAttention && !isSelected && (
                      <div className="absolute top-1.5 left-1.5 text-[10px]">⚠️</div>
                    )}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}

                    {/* Table number */}
                    <span className={cn(
                      "text-[17px] font-black leading-none tracking-tight",
                      isSelected ? "text-blue-700" : statusCfg.num
                    )}>
                      {table.table_number}
                    </span>

                    {/* Status label */}
                    <span className={cn(
                      "text-[9px] font-bold mt-0.5 uppercase tracking-wide",
                      isSelected ? "text-blue-600" : statusCfg.label
                    )}>
                      {isSelected ? "Selected" : statusCfg.text}
                    </span>

                    {/* Capacity / elapsed time */}
                    <span className={cn("text-[9px] leading-none mt-0.5", needsAttention ? "text-orange-700 font-bold" : "text-muted-foreground")}>
                      {elapsedMins !== null ? `${table.capacity}p · ${tableElapsedLabel(elapsedMins)}` : `${table.capacity}p`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
