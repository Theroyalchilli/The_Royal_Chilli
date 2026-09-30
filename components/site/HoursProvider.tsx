"use client";

import { createContext, useContext, useMemo } from "react";
import { weekFromDayHours, type WeekHours } from "@/lib/hours";
import type { DayHours } from "@/lib/opening-hours";

// This website's business's opening hours (Settings → General), loaded once
// by the public layout and shared with the order, checkout, booking and
// "open today" pieces — so they all follow the business's own hours.
const HoursContext = createContext<WeekHours>(weekFromDayHours([]));

export function HoursProvider({ hours, children }: { hours: DayHours[]; children: React.ReactNode }) {
  const week = useMemo(() => weekFromDayHours(hours), [hours]);
  return <HoursContext.Provider value={week}>{children}</HoursContext.Provider>;
}

export function useWeekHours(): WeekHours {
  return useContext(HoursContext);
}
