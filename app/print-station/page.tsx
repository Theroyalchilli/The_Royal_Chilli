"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Ticket } from "@/lib/cloudprnt";
import { ticketHtml } from "@/lib/ticket-html";

// USB Print Station — runs on the till laptop that has the Star mC-Print3 on
// USB, printing everything the POS queues (kitchen tickets from the till, QR
// and website; receipts; Z reports) while the printer can't reach the
// internet for CloudPRNT. Open it from the Chrome shortcut with
// --kiosk-printing so each ticket prints without a dialog (plus
// --disable-background-timer-throttling --disable-renderer-backgrounding
// --disable-backgrounding-occluded-windows, so it keeps pace when hidden).
//
// Stop using it once CloudPRNT works: both take jobs off the same queue, so
// running the two together can print a ticket twice.

const KEY_STORAGE = "rc_print_station_key";
const POLL_MS = 3000;

type State = "starting" | "unpaired" | "ok" | "offline" | "dialog";
type Printed = { at: string; label: string };

function readKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}
function writeKey(key: string | null) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {}
}

const clock = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

// A short, readable label for the activity list, from the ticket's own lines.
function labelFor(ticket: Ticket, kind: string): string {
  const head = ticket.slice(0, 3).map((l) => l.text.trim()).filter((t) => t && !/^-+$/.test(t));
  if (kind === "receipt") return `Receipt — ${head.find((t) => /^Order /.test(t)) ?? head[0] ?? ""}`;
  if (kind === "zreport") return head.find((t) => /Report/.test(t)) ?? "Z report";
  return head.slice(0, 2).join(" · ");
}

// Prints one ticket through a hidden iframe. With --kiosk-printing it goes
// straight to the default printer; without it Chrome shows the print dialog
// and print() blocks until it's closed — that's how a missing shortcut flag
// is spotted (returns "dialog").
function printTicket(ticket: Ticket): Promise<"printed" | "dialog"> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0;";
    frame.srcdoc = ticketHtml(ticket);
    frame.onload = () => {
      const started = Date.now();
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      const blockedFor = Date.now() - started;
      setTimeout(() => {
        frame.remove();
        resolve(blockedFor > 2500 ? "dialog" : "printed");
      }, 1000);
    };
    document.body.appendChild(frame);
  });
}

// Short beep for problems — browsers only allow sound after someone has
// clicked on the page, so it's armed by the first click.
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

export default function PrintStationPage() {
  const [key, setKey] = useState<string | null>(null);
  const [state, setState] = useState<State>("starting");
  const [printed, setPrinted] = useState<Printed[]>([]);
  const [lastCheck, setLastCheck] = useState<string>("");
  const [pairError, setPairError] = useState("");
  const [pairing, setPairing] = useState(false);
  const busy = useRef(false);
  const soundArmed = useRef(false);

  useEffect(() => {
    const k = readKey();
    setKey(k);
    setState(k ? "ok" : "unpaired");
  }, []);

  const poll = useCallback(async () => {
    if (!key || busy.current) return;
    busy.current = true;
    try {
      // Drain the backlog one ticket at a time, oldest first.
      for (;;) {
        const res = await fetch("/api/print/station/next", { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
        if (res.status === 401) {
          setState("unpaired");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setLastCheck(clock());
        if (!data.job) {
          setState((s) => (s === "dialog" ? s : "ok"));
          return;
        }
        const outcome = await printTicket(data.ticket);
        await fetch("/api/print/station/done", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ id: data.job.id }),
        });
        setPrinted((p) => [{ at: clock(), label: labelFor(data.ticket, data.job.kind) }, ...p].slice(0, 12));
        setState(outcome === "dialog" ? "dialog" : "ok");
      }
    } catch {
      setState("offline");
    } finally {
      busy.current = false;
    }
  }, [key]);

  // The 3s tick comes from a Web Worker: Chrome throttles a hidden or
  // minimised page's own timers to about once a minute, which delayed tickets
  // by up to 60s; worker timers aren't throttled that way. (The desktop
  // shortcut also starts Chrome with background throttling switched off.)
  useEffect(() => {
    if (!key) return;
    poll();
    let worker: Worker | null = null;
    let fallback: ReturnType<typeof setInterval> | null = null;
    try {
      const src = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${POLL_MS});`], { type: "text/javascript" }));
      worker = new Worker(src);
      URL.revokeObjectURL(src);
      worker.onmessage = () => poll();
    } catch {
      fallback = setInterval(poll, POLL_MS);
    }
    return () => {
      worker?.terminate();
      if (fallback) clearInterval(fallback);
    };
  }, [key, poll]);

  // Keep the screen (and so the page) awake; re-acquired whenever the tab
  // comes back to the front, since the browser drops it when hidden.
  useEffect(() => {
    type WakeLock = { request: (t: "screen") => Promise<unknown> };
    const wl = (navigator as unknown as { wakeLock?: WakeLock }).wakeLock;
    if (!wl) return;
    const acquire = () => { if (document.visibilityState === "visible") wl.request("screen").catch(() => {}); };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => document.removeEventListener("visibilitychange", acquire);
  }, []);

  // Beep every 15s while something's wrong, once sound has been armed.
  useEffect(() => {
    if (state === "ok" || state === "starting") return;
    const t = setInterval(() => { if (soundArmed.current) beep(); }, 15000);
    return () => clearInterval(t);
  }, [state]);

  async function pair() {
    setPairing(true);
    setPairError("");
    try {
      const res = await fetch("/api/print/station/pair", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPairError(res.status === 401 ? "Log in as a manager first (link below), then press Pair again." : data.error || "Pairing failed");
        return;
      }
      writeKey(data.key);
      setKey(data.key);
      setState("ok");
    } finally {
      setPairing(false);
    }
  }

  async function testPrint() {
    await printTicket([
      { text: "THE ROYAL CHILLI", align: "center", bold: true, size: "big" },
      { text: "PRINT STATION TEST", align: "center", bold: true },
      { text: `Printed ${new Date().toLocaleString("en-GB")}`, align: "center" },
      { text: "If this printed without a", align: "center" },
      { text: "print dialog, you're all set.", align: "center" },
    ]).then((o) => setState(o === "dialog" ? "dialog" : key ? "ok" : "unpaired"));
  }

  const banner: Record<State, { bg: string; title: string; text: string }> = {
    starting: { bg: "#6b7280", title: "Starting…", text: "" },
    ok: { bg: "#059669", title: "✅ Printing automatically", text: `Checking for new tickets every few seconds${lastCheck ? ` · last check ${lastCheck}` : ""}. Leave this page open.` },
    offline: { bg: "#dc2626", title: "⚠️ Can't reach the POS", text: "Check this computer's internet connection. Tickets are kept and will print when it's back." },
    unpaired: { bg: "#d97706", title: "Not paired", text: "This computer isn't the Print Station yet (or another computer was paired since). A manager needs to pair it below." },
    dialog: { bg: "#dc2626", title: "⚠️ Print dialog is appearing", text: "Chrome wasn't opened with the Print Station shortcut, so tickets won't print on their own. Close Chrome and open it from the \"Print Station\" shortcut." },
  };
  const b = banner[state];

  return (
    <div onClick={() => { soundArmed.current = true; }} style={{ minHeight: "100vh", background: "#f5f5f4", fontFamily: "system-ui, sans-serif", color: "#1c1917" }}>
      <div style={{ background: b.bg, color: "#fff", padding: "28px 24px" }}>
        <div style={{ fontSize: 30, fontWeight: 800 }}>{b.title}</div>
        {b.text && <div style={{ marginTop: 6, fontSize: 16, opacity: 0.95 }}>{b.text}</div>}
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: 24, display: "grid", gap: 20 }}>
        {state === "unpaired" && (
          <section style={{ background: "#fff", borderRadius: 12, padding: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Pair this computer</h2>
            <p style={{ color: "#57534e", fontSize: 14 }}>
              A manager pairs this computer once; it then stays connected (it can only print — no access to orders or
              reports). Pairing another computer later disconnects this one.
            </p>
            <button onClick={pair} disabled={pairing} style={{ background: "#b91c1c", color: "#fff", border: 0, borderRadius: 10, padding: "12px 20px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              {pairing ? "Pairing…" : "Pair this computer"}
            </button>
            {pairError && <p style={{ color: "#b91c1c", fontSize: 14 }}>{pairError}</p>}
            <p style={{ fontSize: 13, color: "#78716c" }}>
              Not logged in? <a href="/login" target="_blank" rel="noreferrer">Log in as a manager</a> in a new tab, then come back and press Pair.
            </p>
          </section>
        )}

        <section style={{ background: "#fff", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Printed today (this screen)</h2>
            <button onClick={testPrint} style={{ background: "#e7e5e4", border: 0, borderRadius: 8, padding: "8px 14px", fontWeight: 600, cursor: "pointer" }}>
              🖨️ Test print
            </button>
          </div>
          {printed.length === 0 ? (
            <p style={{ color: "#78716c", fontSize: 14 }}>Nothing yet — new orders will appear here as they print.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 6 }}>
              {printed.map((p, i) => (
                <li key={i} style={{ display: "flex", gap: 12, fontSize: 15 }}>
                  <span style={{ color: "#78716c", fontVariantNumeric: "tabular-nums" }}>{p.at}</span>
                  <span>{p.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p style={{ fontSize: 13, color: "#78716c" }}>
          Keep this computer on, plugged in and on this page during opening hours. If it&apos;s closed, new tickets wait
          and print when it&apos;s back (anything older than 6 hours is skipped).
        </p>
      </div>
    </div>
  );
}
