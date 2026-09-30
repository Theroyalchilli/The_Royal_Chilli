"use client";

import { useEffect, useState } from "react";
import { formatHoursForDate } from "@/lib/hours";
import { useWeekHours } from "@/components/site/HoursProvider";

// The homepage hero is a static server component, so today's hours can't be
// computed there directly (it would bake in whatever day the page was last
// built on and never update). Renders client-side instead — hours are the
// same every day, so the default below never actually needs correcting,
// but this still stays reactive if that ever changes again.
export default function TodayHours() {
  // The business's own hours (Settings → General).
  const week = useWeekHours();
  const [hours, setHours] = useState("");
  useEffect(() => {
    setHours(formatHoursForDate(week, new Date()));
  }, [week]);
  return <>{hours}</>;
}
