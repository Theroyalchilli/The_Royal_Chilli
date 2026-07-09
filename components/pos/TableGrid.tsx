"use client";

import { cn } from "@/lib/utils";
import type { RestaurantTable } from "@/lib/types";

interface Props {
  tables: RestaurantTable[];
  selectedTable: number | null;
  onSelect: (table: RestaurantTable) => void;
}

const statusColors: Record<string, string> = {
  available: "bg-green-900/50 border-green-600 hover:bg-green-800/70 text-green-300",
  occupied: "bg-red-900/50 border-red-600 text-red-300 cursor-not-allowed",
  reserved: "bg-yellow-900/50 border-yellow-600 hover:bg-yellow-800/70 text-yellow-300",
};

const statusLabels: Record<string, string> = {
  available: "Free",
  occupied: "Occupied",
  reserved: "Reserved",
};

const statusDot: Record<string, string> = {
  available: "bg-emerald-400",
  occupied: "bg-red-400",
  reserved: "bg-amber-400",
};

export default function TableGrid({ tables, selectedTable, onSelect }: Props) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {tables.map((table) => {
        const isSelected = selectedTable === table.id;
        const isOccupied = table.status === "occupied";
        return (
          <button
            key={table.id}
            onClick={() => onSelect(table)}
            className={cn(
              "pos-btn no-select relative flex flex-col items-center justify-center rounded-xl border-2 h-[58px] transition-all duration-150",
              isOccupied
                ? "bg-red-950/60 border-red-700 hover:border-red-400 hover:bg-red-950/80"
                : table.status === "reserved"
                ? "bg-amber-950/50 border-amber-700 hover:border-amber-500"
                : "bg-gray-800/80 border-gray-700 hover:border-emerald-500 hover:bg-gray-800",
              isSelected && "border-orange-400 bg-orange-950/40 ring-2 ring-orange-400/40"
            )}
          >
            {/* Status dot */}
            <div className={cn("absolute top-1.5 right-1.5 w-2 h-2 rounded-full", statusDot[table.status])} />
            {/* Location badge */}
            {table.location !== "main" && (
              <div className="absolute top-1 left-1 text-[8px] font-bold text-gray-400 leading-none">
                {table.location === "outdoor" ? "OUT" : "VIP"}
              </div>
            )}
            <span className={cn(
              "text-base font-extrabold leading-none",
              isSelected ? "text-orange-300" : isOccupied ? "text-red-300" : "text-white"
            )}>
              {table.table_number}
            </span>
            {/* Show "open bill" hint on occupied tables */}
            <span className="text-[9px] mt-0.5 leading-none text-gray-400">
              {isOccupied ? "open bill" : `${table.capacity}p`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
