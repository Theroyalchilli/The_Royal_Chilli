"use client";

import { cn } from "@/lib/utils";
import type { RestaurantTable } from "@/lib/types";

interface Props {
  tables: RestaurantTable[];
  selectedTable: number | null;
  onSelect: (table: RestaurantTable) => void;
}

const locationLabel: Record<string, string> = {
  main: "Main",
  outdoor: "Outdoor",
  private: "Private",
};

export default function TableGrid({ tables, selectedTable, onSelect }: Props) {
  const grouped = {
    main:    tables.filter(t => t.location === "main"),
    outdoor: tables.filter(t => t.location === "outdoor"),
    private: tables.filter(t => t.location === "private"),
  };

  const stats = {
    free:     tables.filter(t => t.status === "available").length,
    occupied: tables.filter(t => t.status === "occupied").length,
    reserved: tables.filter(t => t.status === "reserved").length,
  };

  return (
    <div className="space-y-4">

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Free",     count: stats.free,     color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/30" },
          { label: "Occupied", count: stats.occupied, color: "text-red-600",     bg: "bg-red-500/10 border-red-500/30" },
          { label: "Reserved", count: stats.reserved, color: "text-amber-600",   bg: "bg-amber-500/10 border-amber-500/30" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border px-3 py-2 text-center ${s.bg}`}>
            <div className={`text-xl font-black ${s.color}`}>{s.count}</div>
            <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table groups */}
      {(["main", "outdoor", "private"] as const).map(loc => {
        const group = grouped[loc];
        if (group.length === 0) return null;
        return (
          <div key={loc}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                {locationLabel[loc]}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {group.map(table => {
                const isSelected = selectedTable === table.id;
                const status = table.status as "available" | "occupied" | "reserved";

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
                }[status];

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

                    {/* Pulsing dot for occupied */}
                    {status === "occupied" && !isSelected && (
                      <div className="absolute top-2 right-2">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                        </span>
                      </div>
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

                    {/* Capacity */}
                    <span className="text-[9px] text-muted-foreground leading-none mt-0.5">
                      {table.capacity}p
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
