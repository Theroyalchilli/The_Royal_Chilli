"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ClockEvent } from "@/lib/types";

function fmt(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function durationLabel(start: string, end: string | null) {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.round((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
}

function CorrectionModal({ event, onClose, onSubmitted }: { event: ClockEvent; onClose: () => void; onSubmitted: () => void }) {
  const [clockIn, setClockIn] = useState(event.clock_in.slice(0, 16));
  const [clockOut, setClockOut] = useState(event.clock_out ? event.clock_out.slice(0, 16) : "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!reason.trim()) return setError("Please explain what needs fixing.");
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/attendance/${event.id}/correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_clock_in: new Date(clockIn).toISOString(),
          requested_clock_out: clockOut ? new Date(clockOut).toISOString() : null,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5">
        <h2 className="text-foreground font-bold text-lg">Request Correction</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-muted-foreground">Correct clock-in time</label>
          <input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          <label className="block text-xs text-muted-foreground">Correct clock-out time</label>
          <input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          <textarea placeholder="What went wrong?" value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
            className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
        </div>
        {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 bg-elevated hover:bg-elevated-hover text-foreground font-semibold rounded-xl">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 h-10 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl">
            {saving ? "Sending…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AttendanceView({ isManager }: { isManager: boolean }) {
  const [tab, setTab] = useState<"me" | "team">("me");
  const [open, setOpen] = useState<ClockEvent | null>(null);
  const [onBreak, setOnBreak] = useState(false);
  const [history, setHistory] = useState<ClockEvent[]>([]);
  const [correctingEvent, setCorrectingEvent] = useState<ClockEvent | null>(null);
  const [teamEvents, setTeamEvents] = useState<(ClockEvent & { staff_name: string })[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, forceTick] = useState(0);

  const refreshMe = useCallback(async () => {
    const res = await fetch("/api/attendance/me");
    const data = await res.json();
    setOpen(data.open);
    setOnBreak(!!data.openBreak);
    setHistory(data.history || []);
  }, []);

  const refreshTeam = useCallback(async () => {
    const res = await fetch("/api/attendance?pending_only=0");
    const data = await res.json();
    setTeamEvents(data.clockEvents || []);
  }, []);

  useEffect(() => { refreshMe(); }, [refreshMe]);
  useEffect(() => { if (isManager && tab === "team") refreshTeam(); }, [isManager, tab, refreshTeam]);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  async function action(path: string, body?: object) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function decideCorrection(id: number, decision: "approved" | "rejected") {
    await fetch(`/api/attendance/${id}/correction`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
    refreshTeam();
  }

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-foreground font-bold text-2xl">Attendance</h1>
            <div className="flex items-center gap-2">
              <Link href="/staff" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border">← Staff Hub</Link>
            </div>
          </div>

          {isManager && (
            <div className="flex flex-wrap gap-1 mt-4 bg-surface-hover p-1 rounded-xl">
              <button onClick={() => setTab("me")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === "me" ? "bg-red-500 text-white" : "text-muted-foreground"}`}>My Attendance</button>
              <button onClick={() => setTab("team")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === "team" ? "bg-red-500 text-white" : "text-muted-foreground"}`}>Team</button>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        {tab === "me" && (
          <>
            <div className="mt-6 rounded-2xl border border-border bg-surface p-6 text-center">
              {open ? (
                <>
                  <p className="text-muted-foreground text-sm">Clocked in since {fmt(open.clock_in)}</p>
                  <p className="text-foreground font-bold text-3xl mt-1">{durationLabel(open.clock_in, null)}</p>
                  {open.late_minutes > 0 && <p className="text-amber-600 text-xs mt-1">{open.late_minutes} min late</p>}
                  <div className="flex gap-3 mt-4 justify-center">
                    <button onClick={() => action(onBreak ? "/api/attendance/break" : "/api/attendance/break", { action: onBreak ? "end" : "start" })}
                      disabled={busy} className="px-5 py-2.5 bg-elevated hover:bg-elevated-hover text-foreground text-sm font-bold rounded-xl disabled:opacity-50">
                      {onBreak ? "▶ End Break" : "⏸ Start Break"}
                    </button>
                    <button onClick={() => action("/api/attendance/clock-out")} disabled={busy}
                      className="px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white text-sm font-bold rounded-xl disabled:opacity-50">
                      ⏹ Clock Out
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">You&apos;re not clocked in</p>
                  <button onClick={() => action("/api/attendance/clock-in")} disabled={busy}
                    className="mt-4 px-8 py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl disabled:opacity-50">
                    ▶ Clock In
                  </button>
                </>
              )}
              {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}
            </div>

            <div className="mt-6">
              <h2 className="text-muted-foreground text-xs font-bold uppercase tracking-widest mb-2">Last 14 Days</h2>
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="rounded-xl border border-border bg-surface px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-foreground text-sm font-medium">{fmt(h.clock_in)} → {h.clock_out ? fmt(h.clock_out) : "still open"}</p>
                      <p className="text-muted-foreground text-xs">{durationLabel(h.clock_in, h.clock_out)} {h.late_minutes > 0 && `· ${h.late_minutes}m late`}</p>
                    </div>
                    {h.correction_status === "pending" ? (
                      <span className="text-xs text-amber-600 font-semibold">Correction pending</span>
                    ) : h.status === "closed" ? (
                      <button onClick={() => setCorrectingEvent(h)} className="text-xs text-red-600 hover:text-red-700 font-semibold">Request Correction</button>
                    ) : null}
                  </div>
                ))}
                {history.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No attendance history yet.</p>}
              </div>
            </div>
          </>
        )}

        {tab === "team" && isManager && (
          <div className="mt-6 space-y-2">
            {teamEvents.map((e) => (
              <div key={e.id} className="rounded-xl border border-border bg-surface px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-foreground text-sm font-medium">{e.staff_name} — {fmt(e.clock_in)} → {e.clock_out ? fmt(e.clock_out) : "still open"}</p>
                  <p className="text-muted-foreground text-xs">{durationLabel(e.clock_in, e.clock_out)} {e.late_minutes > 0 && `· ${e.late_minutes}m late`}</p>
                  {e.correction_status === "pending" && (
                    <p className="text-amber-600 text-xs mt-1">Requesting: {e.requested_clock_in ? fmt(e.requested_clock_in) : "—"} → {e.requested_clock_out ? fmt(e.requested_clock_out) : "—"} ({e.correction_reason})</p>
                  )}
                </div>
                {e.correction_status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => decideCorrection(e.id, "approved")} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg">Approve</button>
                    <button onClick={() => decideCorrection(e.id, "rejected")} className="px-3 py-1.5 bg-elevated hover:bg-elevated-hover text-foreground text-xs font-bold rounded-lg">Reject</button>
                  </div>
                )}
              </div>
            ))}
            {teamEvents.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">No attendance records yet.</p>}
          </div>
        )}
      </div>

      {correctingEvent && (
        <CorrectionModal event={correctingEvent} onClose={() => setCorrectingEvent(null)} onSubmitted={refreshMe} />
      )}
      </div>
    </>
  );
}
