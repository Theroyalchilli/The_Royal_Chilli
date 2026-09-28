"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Till PIN lock. The till stays signed in all day (a manager logs in each
// morning); after 5 minutes of no use — or when someone taps Lock — it shows
// a PIN pad, and whoever enters their PIN becomes the signed-in person
// (app/api/auth/pin), so their orders, payments, voids, discounts and Close
// Day are recorded against them. The lock survives a page refresh. The
// Kitchen Display is never locked, and new-order alerts show above the lock.

const IDLE_MS = 5 * 60_000;
const LOCK_KEY = "rc_till_locked";
export const SESSION_CHANGED_EVENT = "pos-session-changed";

function readLocked(): boolean {
  try {
    return localStorage.getItem(LOCK_KEY) === "1";
  } catch {
    return false;
  }
}
function writeLocked(v: boolean) {
  try {
    if (v) localStorage.setItem(LOCK_KEY, "1");
    else localStorage.removeItem(LOCK_KEY);
  } catch {}
}

export default function TillLock() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  // Screens that must never lock: the Kitchen Display and print pages.
  const exempt = pathname.startsWith("/pos/kitchen") || pathname.startsWith("/pos/receipt");
  const [locked, setLocked] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Off until at least one staff PIN exists (Staff Hub → HR), so the lock
  // can never shut out a till where nobody has a PIN yet.
  const [enabled, setEnabled] = useState(false);
  const lastActivity = useRef(Date.now());

  const lock = useCallback(() => {
    writeLocked(true);
    setLocked(true);
    setPin("");
    setError("");
  }, []);

  const loadUser = useCallback(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUser(d?.user?.name ?? d?.name ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (exempt) return;
    fetch("/api/staff-pin", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const on = (d?.pins_set ?? 0) > 0;
        setEnabled(on);
        if (!on) writeLocked(false);
      })
      .catch(() => {});
  }, [exempt]);

  useEffect(() => {
    if (exempt || !enabled) return;
    setLocked(readLocked());
    loadUser();
    const touch = () => { lastActivity.current = Date.now(); };
    window.addEventListener("pointerdown", touch, { capture: true });
    window.addEventListener("keydown", touch, { capture: true });
    const t = setInterval(() => {
      if (Date.now() - lastActivity.current >= IDLE_MS && !readLocked()) lock();
    }, 15_000);
    return () => {
      window.removeEventListener("pointerdown", touch, { capture: true });
      window.removeEventListener("keydown", touch, { capture: true });
      clearInterval(t);
    };
  }, [exempt, enabled, lock, loadUser]);

  const submit = useCallback(async (value: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Wrong PIN");
        setPin("");
        if (res.status === 401 && data.error?.includes("isn't signed in")) router.push("/login");
        return;
      }
      writeLocked(false);
      setLocked(false);
      setPin("");
      setUser(data.user?.name ?? null);
      lastActivity.current = Date.now();
      // Let the till page pick up the new person (role, name) without a reload.
      window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [router]);

  const press = (d: string) => {
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setError("");
    if (next.length === 4) submit(next);
  };

  if (exempt || !enabled) return null;

  if (!locked) {
    return (
      <button
        onClick={lock}
        className="fixed bottom-3 left-3 z-40 flex items-center gap-2 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur"
        title="Lock the till — the next person enters their PIN"
      >
        👤 {user ?? "…"} <span className="text-muted-foreground">·</span> 🔒 Lock
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-2xl bg-surface p-6 text-center shadow-2xl">
        <div className="text-3xl">🔒</div>
        <h2 className="mt-2 text-lg font-bold text-foreground">Till locked</h2>
        <p className="text-sm text-muted-foreground">Enter your 4-digit PIN</p>
        <div className="my-4 flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? "border-foreground bg-foreground" : "border-muted-foreground"}`} />
          ))}
        </div>
        {error && <p className="mb-2 text-sm font-semibold text-red-600">{error}</p>}
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} onClick={() => press(d)} disabled={busy} className="h-14 rounded-xl bg-surface-hover text-xl font-bold text-foreground active:bg-elevated disabled:opacity-50">
              {d}
            </button>
          ))}
          <button onClick={() => { setPin(""); setError(""); }} className="h-14 rounded-xl bg-surface-hover text-sm font-semibold text-muted-foreground">
            Clear
          </button>
          <button onClick={() => press("0")} disabled={busy} className="h-14 rounded-xl bg-surface-hover text-xl font-bold text-foreground active:bg-elevated disabled:opacity-50">
            0
          </button>
          <button onClick={() => setPin((p) => p.slice(0, -1))} className="h-14 rounded-xl bg-surface-hover text-xl text-muted-foreground">
            ⌫
          </button>
        </div>
        <a href="/login" onClick={() => writeLocked(false)} className="mt-4 inline-block text-xs text-muted-foreground underline">
          Manager: sign in with password
        </a>
      </div>
    </div>
  );
}
