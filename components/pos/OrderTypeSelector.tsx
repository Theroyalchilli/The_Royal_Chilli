"use client";

import { cn } from "@/lib/utils";

type OrderType = "dine_in" | "takeaway" | "delivery";

interface Props {
  value: OrderType;
  onChange: (type: OrderType) => void;
}

const types: { id: OrderType; label: string; icon: string }[] = [
  { id: "dine_in", label: "Dine-In", icon: "🍽️" },
  { id: "takeaway", label: "Takeaway", icon: "🥡" },
  { id: "delivery", label: "Delivery", icon: "🛵" },
];

export default function OrderTypeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 p-1 bg-gray-900 rounded-xl">
      {types.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-xs font-semibold transition-all no-select pos-btn",
            value === t.id
              ? "bg-orange-500 text-white shadow"
              : "text-gray-400 hover:text-white hover:bg-gray-700"
          )}
        >
          <span className="text-base">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
