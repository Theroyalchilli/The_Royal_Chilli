"use client";

import { useEffect, useState } from "react";
import { isRestaurantOpen } from "@/lib/hours";
import { tradingDayStr } from "@/lib/london-date";

// Nudges staff to close the till each night, so every trading day gets its
// own Z report (a till left open ran one Z report across two-plus days).
// Two cases: the open shift started on an earlier trading day (red), or
// it's past closing time and before the 5am day change (amber). Checked
// once a minute from the clock — no server calls.
export function closeDayReminder(openedAt: string, now: Date): "stale" | "afterClose" | null {
  if (tradingDayStr(new Date(openedAt)) < tradingDayStr(now)) return "stale";
  // Closed, and before the 5am trading-day change.
  if (!isRestaurantOpen(now) && tradingDayStr(now) !== tradingDayStr(new Date(now.getTime() + 6 * 3600_000))) return "afterClose";
  return null;
}

export default function CloseDayReminder({ openedAt, onCloseDay }: { openedAt: string | null; onCloseDay: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!openedAt) return null;
  const state = closeDayReminder(openedAt, now);
  if (!state) return null;
  const stale = state === "stale";
  const opened = new Date(openedAt);

  const since = opened.toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`flex-shrink-0 border-b px-4 py-2 ${stale ? "bg-red-50 border-red-300" : "bg-amber-50 border-amber-300"}`}>
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
        <span className={`text-sm font-semibold ${stale ? "text-red-800" : "text-amber-900"}`}>
          {stale
            ? `🔒 Yesterday's till is still open (since ${since}) — close it so each day gets its own Z report.`
            : "🌙 It's closing time — remember to Close Day and print the Z report."}
        </span>
        <button
          onClick={onCloseDay}
          className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-white ${stale ? "bg-red-600 hover:bg-red-500" : "bg-amber-600 hover:bg-amber-500"}`}
        >
          Close Day now
        </button>
      </div>
    </div>
  );
}
