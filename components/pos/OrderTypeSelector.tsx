"use client";

import { cn } from "@/lib/utils";

type OrderType = "dine_in" | "takeaway" | "delivery" | "online";

interface Props {
  value: OrderType;
  onChange: (type: OrderType) => void;
  onlineBadge?: number;
}

const types: { id: OrderType; label: string; icon: string }[] = [
  { id: "dine_in",  label: "Dine-In",  icon: "🍽️" },
  { id: "takeaway", label: "Takeaway", icon: "🥡" },
  { id: "delivery", label: "Delivery", icon: "🛵" },
  { id: "online",   label: "Online",   icon: "🌐" },
];

export default function OrderTypeSelector({ value, onChange, onlineBadge }: Props) {
  return (
    <div className="flex gap-1 p-1 bg-surface rounded-xl">
      {types.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex-1 relative flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-xs font-semibold transition-all no-select pos-btn",
            value === t.id
              ? t.id === "online"
                ? "bg-blue-600 text-white shadow"
                : "bg-red-500 text-white shadow"
              : "text-muted-foreground hover:text-foreground hover:bg-elevated"
          )}
        >
          <span className="text-base">{t.icon}</span>
          <span>{t.label}</span>
          {t.id === "online" && onlineBadge != null && onlineBadge > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
              {onlineBadge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
