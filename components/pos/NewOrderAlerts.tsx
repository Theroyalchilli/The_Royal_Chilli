"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { audioBlocked, playBuzzer, unlockAudio } from "@/lib/buzzer";
import { checkDue } from "@/lib/poll-schedule";

interface OrderAlert {
  id: number; // the kitchen ticket's print job id
  source: "online" | "qr";
  order_number: string;
  order_type: string;
  table_number: string | null;
  customer_name: string | null;
  at: string;
}

const SEEN_KEY = "rc_seen_order_alerts";
// Every 15s around opening hours, only in the tab on screen (a hidden or
// duplicate tab doesn't check, and catches up the moment it's shown);
// every couple of minutes outside opening hours (lib/poll-schedule.ts).
const POLL_MS = 15_000;
const REPEAT_MS = 20_000;
// On a device's very first load, orders older than this count as already
// seen (no chiming through the evening's backlog); newer ones still alert.
const FRESH_MS = 15 * 60 * 1000;

function readSeen(): Set<number> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw) as number[]) : null;
  } catch {
    return null;
  }
}
function writeSeen(ids: Set<number>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-500)));
  } catch {}
}

const TYPE_LABEL: Record<string, string> = { takeaway: "collection", delivery: "delivery", dine_in: "dine-in" };

// Chimes for orders customers placed themselves — website and table QR —
// which no member of staff entered and so could otherwise go unnoticed. The
// chime repeats every 20s until someone taps Seen; "seen" is remembered per
// device, so a refresh doesn't re-alert. Mounted in the POS and Staff Hub
// layouts, so it follows staff to every screen — except the Kitchen Display,
// which doesn't chime.
export default function NewOrderAlerts() {
  const hidden = usePathname()?.startsWith("/pos/kitchen") ?? false;
  const [pending, setPending] = useState<OrderAlert[]>([]);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const seen = useRef<Set<number> | null>(null);
  const shown = useRef<Set<number>>(new Set());

  // Browsers keep a page silent until it's been tapped (lib/buzzer.ts) —
  // the banner shows a big button while that's still the case.
  const enableSound = async () => {
    await unlockAudio();
    setSoundBlocked(audioBlocked());
    playBuzzer();
  };

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/orders/new-alerts", { cache: "no-store" });
      if (!res.ok) return;
      const alerts: OrderAlert[] = (await res.json()).alerts || [];
      if (!seen.current) {
        const cutoff = Date.now() - FRESH_MS;
        seen.current = readSeen() ?? new Set(alerts.filter((a) => new Date(a.at).getTime() < cutoff).map((a) => a.id));
        writeSeen(seen.current);
      }
      const next = alerts.filter((a) => !seen.current!.has(a.id));
      if (next.some((a) => !shown.current.has(a.id))) playBuzzer();
      shown.current = new Set(next.map((a) => a.id));
      setPending(next);
      setSoundBlocked(audioBlocked());
    } catch {
      // next poll retries
    }
  }, []);

  useEffect(() => {
    if (hidden) return;
    let lastCheck = Date.now();
    const check = () => {
      lastCheck = Date.now();
      poll();
    };
    const tick = () => {
      if (document.visibilityState === "visible" && checkDue(lastCheck)) check();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    check();
    const t = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll, hidden]);

  // Keep chiming while anything is unseen.
  useEffect(() => {
    if (pending.length === 0) return;
    const t = setInterval(() => {
      playBuzzer();
      setSoundBlocked(audioBlocked());
    }, REPEAT_MS);
    return () => clearInterval(t);
  }, [pending.length]);

  const markSeen = () => {
    if (!seen.current) return;
    for (const a of pending) seen.current.add(a.id);
    writeSeen(seen.current);
    shown.current = new Set();
    setPending([]);
  };

  if (hidden || pending.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[80] bg-sky-50 border-b-2 border-sky-400 px-4 py-2 shadow-lg">
      <div className="flex items-start justify-between gap-3 max-w-2xl mx-auto">
        <div className="space-y-1">
          {pending.map((a) => (
            <div key={a.id} className="text-sky-900 text-sm font-medium">
              {a.source === "qr"
                ? `📱 New QR order — Table ${a.table_number ?? "?"}`
                : `🌐 New online ${TYPE_LABEL[a.order_type] ?? a.order_type} order — ${a.order_number}${a.customer_name ? ` (${a.customer_name})` : ""}`}
              <span className="ml-2 text-xs text-sky-700">
                {new Date(a.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-shrink-0 gap-2">
          {soundBlocked && (
            <button
              onClick={enableSound}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-sm font-bold rounded-lg transition-colors animate-pulse"
            >
              🔔 Tap to turn on sound
            </button>
          )}
          <button
            onClick={markSeen}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold rounded-lg transition-colors"
          >
            Seen
          </button>
        </div>
      </div>
    </div>
  );
}
