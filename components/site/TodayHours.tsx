"use client";

import { useEffect, useState } from "react";
import { formatHoursForDate } from "@/lib/hours";

// The homepage hero is a static server component, so today's hours can't be
// computed there directly (it would bake in whatever day the page was last
// built on and never update). Renders client-side instead, defaulting to
// the hours that apply on 6 of the week's 7 days (every day but Friday) so
// there's no empty flash before the one-day correction lands post-mount.
export default function TodayHours() {
  const [hours, setHours] = useState("9:00 AM – 11:00 PM");
  useEffect(() => {
    setHours(formatHoursForDate(new Date()));
  }, []);
  return <>{hours}</>;
}
