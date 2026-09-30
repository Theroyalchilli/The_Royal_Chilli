import { tradingDayStr, tradingRangeUtc } from "@/lib/london-date";

// Busy mode for website orders, set from the till (components/pos/BusyModeControl):
// pause online ordering for a while (customers can still schedule for after
// the pause), or add extra prep time to every online order. Stored in
// the business's busy_mode setting (business_settings); "until closing" ends at the next 5am trading-day
// change, so tomorrow always starts normal. Table QR and till orders are
// unaffected. Safe to import in the browser.

export type BusyMode = { paused_until: string | null; extra_minutes: number; extra_until: string | null };
export type BusyState = { paused: boolean; pausedUntil: string | null; extraMinutes: number };

export const NORMAL_MODE: BusyMode = { paused_until: null, extra_minutes: 0, extra_until: null };

export function endOfTradingDay(now: Date = new Date()): string {
  return new Date(new Date(tradingRangeUtc(tradingDayStr(now)).end).getTime() + 1).toISOString();
}

export function busyState(mode: BusyMode | null | undefined, now: Date = new Date()): BusyState {
  const m = mode ?? NORMAL_MODE;
  const paused = !!m.paused_until && new Date(m.paused_until).getTime() > now.getTime();
  const extraActive = m.extra_minutes > 0 && !!m.extra_until && new Date(m.extra_until).getTime() > now.getTime();
  return { paused, pausedUntil: paused ? m.paused_until : null, extraMinutes: extraActive ? m.extra_minutes : 0 };
}

// Why an online order can't be taken right now, or null if it's fine.
// scheduledFor: null = ASAP.
export function busyOrderError(state: BusyState, scheduledFor: string | null, now: Date = new Date()): string | null {
  const t = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
  if (state.paused && state.pausedUntil) {
    if (!scheduledFor || new Date(scheduledFor).getTime() < new Date(state.pausedUntil).getTime()) {
      return `We're very busy right now — online ordering is paused until ${t(state.pausedUntil)}. Please schedule your order for ${t(state.pausedUntil)} or later.`;
    }
  }
  if (state.extraMinutes > 0 && scheduledFor) {
    const minLead = (20 + state.extraMinutes) * 60_000;
    if (new Date(scheduledFor).getTime() - now.getTime() < minLead) {
      return `We're busy tonight — please choose a time at least ${20 + state.extraMinutes} minutes from now.`;
    }
  }
  return null;
}
