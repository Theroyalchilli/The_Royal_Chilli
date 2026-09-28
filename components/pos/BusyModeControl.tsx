"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { BusyState } from "@/lib/busy-mode";

// Till control for busy mode (lib/busy-mode.ts): pause website ordering or
// add extra prep time, and always shows what's currently on. Reads the state
// when opened and every few minutes — not a tight loop.
const REFRESH_MS = 3 * 60_000;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });

export default function BusyModeControl() {
  const exempt = (usePathname() ?? "").startsWith("/pos/kitchen");
  const [state, setState] = useState<BusyState | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/busy-mode", { cache: "no-store" }).then((r) => r.json()).then(setState).catch(() => {});
  }, []);
  useEffect(() => {
    if (exempt) return;
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [exempt, load]);

  async function set(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/busy-mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) setState(await res.json());
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (exempt || !state) return null;
  const label = state.paused && state.pausedUntil
    ? `⏸ Online paused till ${hhmm(state.pausedUntil)}`
    : state.extraMinutes > 0
      ? `⏱ Online +${state.extraMinutes} min`
      : "🟢 Online: normal";
  const tone = state.paused ? "bg-red-600 text-white border-red-600" : state.extraMinutes > 0 ? "bg-amber-500 text-white border-amber-500" : "bg-surface/95 text-foreground border-border";

  const Opt = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick} disabled={saving} className="rounded-lg border border-border bg-surface-hover px-3 py-2 text-xs font-semibold text-foreground hover:bg-elevated disabled:opacity-50">
      {children}
    </button>
  );

  return (
    <div className="fixed bottom-3 left-44 z-40">
      {open && (
        <div className="absolute bottom-11 left-0 w-72 rounded-xl border border-border bg-surface p-3 shadow-2xl">
          <div className="text-xs font-bold text-foreground">Pause website orders</div>
          <p className="text-[11px] text-muted-foreground">Customers can still schedule for after the pause.</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Opt onClick={() => set({ action: "pause", minutes: 30 })}>30 min</Opt>
            <Opt onClick={() => set({ action: "pause", minutes: 60 })}>1 hour</Opt>
            <Opt onClick={() => set({ action: "pause", minutes: null })}>Till close</Opt>
          </div>
          <div className="mt-3 text-xs font-bold text-foreground">Extra prep time (online)</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Opt onClick={() => set({ action: "extra", minutes: 15 })}>+15 min</Opt>
            <Opt onClick={() => set({ action: "extra", minutes: 30 })}>+30 min</Opt>
            <Opt onClick={() => set({ action: "extra", minutes: 45 })}>+45 min</Opt>
          </div>
          <button onClick={() => set({ action: "normal" })} disabled={saving} className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
            🟢 Back to normal
          </button>
          <p className="mt-2 text-[10px] text-muted-foreground">Table QR and till orders aren&apos;t affected. Everything resets at closing (5am).</p>
        </div>
      )}
      <button onClick={() => { setOpen((o) => !o); load(); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg ${tone}`}>
        {label}
      </button>
    </div>
  );
}
