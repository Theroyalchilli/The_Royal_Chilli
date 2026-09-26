"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playBuzzer } from "@/lib/buzzer";

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
const POLL_MS = 10_000;
const REPEAT_MS = 20_000;

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
// device, so a refresh doesn't re-alert. The first time a till opens this,
// whatever's already there counts as seen (no chiming through a backlog).
export default function NewOrderAlerts() {
  const [pending, setPending] = useState<OrderAlert[]>([]);
  const [soundArmed, setSoundArmed] = useState(false);
  const seen = useRef<Set<number> | null>(null);
  const shown = useRef<Set<number>>(new Set());

  // Browsers only allow sound after the page has been tapped/clicked once.
  useEffect(() => {
    const arm = () => setSoundArmed(true);
    window.addEventListener("pointerdown", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/orders/new-alerts", { cache: "no-store" });
      if (!res.ok) return;
      const alerts: OrderAlert[] = (await res.json()).alerts || [];
      if (!seen.current) {
        seen.current = readSeen() ?? new Set(alerts.map((a) => a.id));
        writeSeen(seen.current);
      }
      const next = alerts.filter((a) => !seen.current!.has(a.id));
      if (next.some((a) => !shown.current.has(a.id))) playBuzzer();
      shown.current = new Set(next.map((a) => a.id));
      setPending(next);
    } catch {
      // next poll retries
    }
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  // Keep chiming while anything is unseen.
  useEffect(() => {
    if (pending.length === 0) return;
    const t = setInterval(playBuzzer, REPEAT_MS);
    return () => clearInterval(t);
  }, [pending.length]);

  const markSeen = () => {
    if (!seen.current) return;
    for (const a of pending) seen.current.add(a.id);
    writeSeen(seen.current);
    shown.current = new Set();
    setPending([]);
  };

  if (pending.length === 0) return null;

  return (
    <div className="bg-sky-50 border-b border-sky-300 px-4 py-2 flex-shrink-0">
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
          {!soundArmed && <div className="text-xs text-sky-700">🔔 Tap anywhere on the screen to turn on the alert sound</div>}
        </div>
        <button
          onClick={markSeen}
          className="flex-shrink-0 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold rounded-lg transition-colors"
        >
          Seen
        </button>
      </div>
    </div>
  );
}
