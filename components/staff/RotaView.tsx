"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Shift, LeaveRequest } from "@/lib/types";

function mondayOf(d: Date): string {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekdayLabel(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ShiftModal({
  staffId, staffName, date, onClose, onSaved,
}: { staffId: number; staffName: string; date: string; onClose: () => void; onSaved: () => void }) {
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [position, setPosition] = useState("");
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(force = false) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/rota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: staffId, shift_date: date, start_time: startTime, end_time: endTime, position: position || undefined, force }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setConflicts(data.conflicts || []);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to save shift");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-5">
        <h2 className="text-foreground font-bold text-lg">{staffName} · {weekdayLabel(date)}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Start</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">End</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
          </div>
          <input placeholder="Position (optional)" value={position} onChange={(e) => setPosition(e.target.value)} className="col-span-2 bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
        </div>

        {conflicts.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-300/50 bg-amber-50 p-3 space-y-1">
            {conflicts.map((c, i) => <p key={i} className="text-amber-700 text-xs">⚠ {c}</p>)}
            <button onClick={() => save(true)} className="mt-2 text-xs font-bold text-amber-200 underline">Assign Anyway</button>
          </div>
        )}
        {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}

        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 bg-elevated hover:bg-elevated-hover text-foreground font-semibold rounded-xl">Cancel</button>
          <button onClick={() => save(false)} disabled={saving} className="flex-1 h-10 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl">
            {saving ? "Saving…" : "Assign Shift"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AvailabilityEditor() {
  const [days, setDays] = useState<{ day_of_week: number; is_available: number; notes: string | null }[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/availability");
    const data = await res.json();
    setDays(data.days || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  function toggle(dow: number) {
    setDays((prev) => prev.map((d) => (d.day_of_week === dow ? { ...d, is_available: d.is_available ? 0 : 1 } : d)));
  }

  async function save() {
    setSaving(true);
    await fetch("/api/availability", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }) });
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-foreground font-bold">My Weekly Availability</h2>
      <p className="text-muted-foreground text-xs mt-1">Toggle off days you generally can&apos;t work — managers see this when building the rota.</p>
      <div className="mt-4 grid grid-cols-7 gap-2">
        {days.map((d) => (
          <button key={d.day_of_week} onClick={() => toggle(d.day_of_week)}
            className={`rounded-xl border p-3 text-center text-xs font-semibold ${d.is_available ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-border bg-surface-hover text-muted-foreground"}`}>
            {DAY_NAMES[d.day_of_week].slice(0, 3)}
          </button>
        ))}
      </div>
      <button onClick={save} disabled={saving} className="mt-4 px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg">
        {saving ? "Saving…" : "Save Availability"}
      </button>
    </div>
  );
}

function LeaveSection({ isManager }: { isManager: boolean }) {
  const [requests, setRequests] = useState<(LeaveRequest & { staff_name: string })[]>([]);
  const [leaveType, setLeaveType] = useState<"holiday" | "sick" | "unpaid" | "other">("holiday");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/leave-requests");
    const data = await res.json();
    setRequests(data.leaveRequests || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    setError("");
    if (!startDate || !endDate) return setError("Pick a start and end date.");
    const res = await fetch("/api/leave-requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leave_type: leaveType, start_date: startDate, end_date: endDate, reason: reason || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setStartDate(""); setEndDate(""); setReason("");
    load();
  }

  async function decide(id: number, status: "approved" | "rejected") {
    await fetch(`/api/leave-requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-foreground font-bold">Leave</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as typeof leaveType)} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
          <option value="holiday">Holiday</option>
          <option value="sick">Sick</option>
          <option value="unpaid">Unpaid</option>
          <option value="other">Other</option>
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
        <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm flex-1 min-w-[140px]" />
        <button onClick={submit} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">Request</button>
      </div>
      {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}

      <div className="mt-4 space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="rounded-lg border border-border px-3 py-2 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-foreground text-sm">{isManager && <span className="font-semibold">{r.staff_name} · </span>}{r.leave_type} · {r.start_date} → {r.end_date}</p>
              {r.reason && <p className="text-muted-foreground text-xs">{r.reason}</p>}
            </div>
            {isManager && r.status === "pending" ? (
              <div className="flex gap-2">
                <button onClick={() => decide(r.id, "approved")} className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg">Approve</button>
                <button onClick={() => decide(r.id, "rejected")} className="px-3 py-1 bg-elevated hover:bg-elevated-hover text-foreground text-xs font-bold rounded-lg">Reject</button>
              </div>
            ) : (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === "approved" ? "bg-green-100 text-green-700" : r.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                {r.status}
              </span>
            )}
          </div>
        ))}
        {requests.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No leave requests.</p>}
      </div>
    </div>
  );
}

export default function RotaView({ isManager }: { isManager: boolean }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [shifts, setShifts] = useState<(Shift & { staff_name: string })[]>([]);
  const [staffList, setStaffList] = useState<{ id: number; name: string; role: string }[]>([]);
  const [modal, setModal] = useState<{ staffId: number; staffName: string; date: string } | null>(null);
  const [tab, setTab] = useState<"schedule" | "availability" | "leave">("schedule");
  const [loading, setLoading] = useState(true);
  const [copyMsg, setCopyMsg] = useState("");

  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/rota?week_start=${weekStart}`);
    const data = await res.json();
    setShifts(data.shifts || []);
    setStaffList(data.staff || []);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  async function copyPreviousWeek() {
    setCopyMsg("");
    const res = await fetch("/api/rota/copy-week", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_week_start: addDays(weekStart, -7), to_week_start: weekStart }),
    });
    const data = await res.json();
    setCopyMsg(res.ok ? `Copied ${data.copied} shift(s)${data.skipped ? `, skipped ${data.skipped} (already scheduled)` : ""}.` : data.error);
    load();
  }

  async function deleteShift(id: number) {
    await fetch(`/api/rota/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-foreground font-bold text-2xl">Rota</h1>
            <div className="flex items-center gap-2">
              <Link href="/staff" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border">← Staff Hub</Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mt-4 bg-surface-hover p-1 rounded-xl">
            <button onClick={() => setTab("schedule")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === "schedule" ? "bg-red-500 text-white" : "text-muted-foreground"}`}>Schedule</button>
            <button onClick={() => setTab("availability")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === "availability" ? "bg-red-500 text-white" : "text-muted-foreground"}`}>Availability</button>
            <button onClick={() => setTab("leave")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === "leave" ? "bg-red-500 text-white" : "text-muted-foreground"}`}>Leave</button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
      <div className="mx-auto max-w-5xl">
        {tab === "schedule" && (
          <>
            <div className="flex items-center justify-between mt-5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="px-3 py-1.5 bg-surface-hover hover:bg-elevated text-foreground rounded-lg border border-border text-sm">← Prev</button>
                <span className="text-foreground text-sm font-semibold">{weekdayLabel(dates[0])} – {weekdayLabel(dates[6])}</span>
                <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="px-3 py-1.5 bg-surface-hover hover:bg-elevated text-foreground rounded-lg border border-border text-sm">Next →</button>
              </div>
              {isManager && (
                <button onClick={copyPreviousWeek} className="px-3 py-1.5 bg-surface-hover hover:bg-elevated text-foreground rounded-lg border border-border text-sm">📋 Copy Previous Week</button>
              )}
            </div>
            {copyMsg && <p className="mt-2 text-emerald-600 text-sm">{copyMsg}</p>}

            {loading ? (
              <div className="text-muted-foreground text-center py-16">Loading…</div>
            ) : isManager ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm min-w-[800px]">
                  <thead className="bg-surface text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 sticky left-0 bg-surface">Staff</th>
                      {dates.map((d) => <th key={d} className="text-center px-2 py-2">{weekdayLabel(d)}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {staffList.map((s) => (
                      <tr key={s.id} className="bg-background">
                        <td className="px-3 py-2 text-foreground font-medium sticky left-0 bg-background whitespace-nowrap">{s.name}</td>
                        {dates.map((d) => {
                          const dayShifts = shifts.filter((sh) => sh.staff_id === s.id && sh.shift_date === d && sh.status !== "cancelled");
                          return (
                            <td key={d} className="px-2 py-2 text-center">
                              {dayShifts.length > 0 ? (
                                dayShifts.map((sh) => (
                                  <div key={sh.id} className="group relative inline-block">
                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg whitespace-nowrap">
                                      {sh.start_time.slice(0, 5)}–{sh.end_time.slice(0, 5)}
                                    </span>
                                    <button onClick={() => deleteShift(sh.id)} className="ml-1 text-muted-foreground hover:text-red-600 text-xs">✕</button>
                                  </div>
                                ))
                              ) : (
                                <button onClick={() => setModal({ staffId: s.id, staffName: s.name, date: d })} className="text-muted-foreground hover:text-red-600 text-lg leading-none">+</button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {shifts.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No shifts scheduled this week.</p>
                ) : (
                  shifts.map((sh) => (
                    <div key={sh.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                      <p className="text-foreground text-sm font-medium">{weekdayLabel(sh.shift_date)}</p>
                      <p className="text-muted-foreground text-sm">{sh.start_time.slice(0, 5)} – {sh.end_time.slice(0, 5)} {sh.position && `· ${sh.position}`}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {tab === "availability" && <div className="mt-5"><AvailabilityEditor /></div>}
        {tab === "leave" && <div className="mt-5"><LeaveSection isManager={isManager} /></div>}
      </div>

      {modal && (
        <ShiftModal staffId={modal.staffId} staffName={modal.staffName} date={modal.date} onClose={() => setModal(null)} onSaved={load} />
      )}
      </div>
    </>
  );
}
