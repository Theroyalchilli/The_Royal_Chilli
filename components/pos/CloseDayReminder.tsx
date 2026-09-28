"use client";

import { useEffect, useState } from "react";
import { tradingDayStr } from "@/lib/london-date";

// Warns when the open till shift started on an earlier trading day (5am
// change), so each day gets its own Z report — a till left open ran one Z
// report across two-plus days. Checked once a minute from the clock — no
// server calls. (No "closing time" nudge: the day closes when staff close it.)
export function closeDayReminder(openedAt: string, now: Date): "stale" | null {
  return tradingDayStr(new Date(openedAt)) < tradingDayStr(now) ? "stale" : null;
}

export default function CloseDayReminder({ openedAt, onCloseDay }: { openedAt: string | null; onCloseDay: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!openedAt || !closeDayReminder(openedAt, now)) return null;
  const since = new Date(openedAt).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="flex-shrink-0 border-b border-red-300 bg-red-50 px-4 py-2">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
        <span className="text-sm font-semibold text-red-800">
          🔒 Yesterday&apos;s till is still open (since {since}) — close it so each day gets its own Z report.
        </span>
        <button onClick={onCloseDay} className="flex-shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500">
          Close Day now
        </button>
      </div>
    </div>
  );
}
