"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getScheduleSlotOptions, toDateInputValue } from "@/lib/hours";

type Booking = {
  id: number;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  status: string;
  notes: string | null;
  deposit_amount: number;
};

const statusLabel: Record<string, string> = {
  pending: "Requested", confirmed: "Confirmed", seated: "Seated",
  cancelled: "Cancelled", no_show: "No show", waitlisted: "Waitlisted",
};
const statusTone: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  confirmed: "bg-emerald-500/10 text-emerald-600",
  seated: "bg-emerald-500/10 text-emerald-600",
  cancelled: "bg-muted text-muted-foreground",
  no_show: "bg-muted text-muted-foreground",
  waitlisted: "bg-primary/10 text-primary",
};

function fmtTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}
function fmtDate(d: string) {
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function BookingsView() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [time, setTime] = useState("");
  const [guests, setGuests] = useState("2");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const timeOptions = useMemo(() => {
    const opts = getScheduleSlotOptions(new Date(date + "T00:00:00"));
    return opts.map((o) => ({ value: o.value.slice(11, 16), label: o.label }));
  }, [date]);
  useEffect(() => {
    if (timeOptions.length > 0 && !timeOptions.some((o) => o.value === time)) setTime(timeOptions[0].value);
  }, [timeOptions, time]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/account/bookings");
    if (res.ok) setBookings((await res.json()).bookings || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    setMsg("");
    if (!phone.trim()) { setMsg("Please enter a mobile number"); return; }
    if (!time) { setMsg("Please choose a time"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/account/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, reservation_date: date, reservation_time: time, party_size: Number(guests), notes }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || "Something went wrong"); return; }
      setMsg(data.waitlisted ? "Fully booked — you've been added to the waitlist." : "Booking requested — we'll confirm shortly.");
      setNotes("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-playfair)] text-2xl">Bookings</h1>

      <div className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Book a table</div>
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        {/* flex-wrap, not a strict 2-column grid — a native date input has
            its own browser-controlled minimum rendering width that a rigid
            50/50 split could squeeze below, which is what caused it to
            clip/overlap the time select next to it. Giving each field a
            guaranteed min-width and letting them wrap only if they truly
            don't fit keeps them on one row on real phones while never
            actually overlapping on anything narrower. */}
        <div className="flex flex-wrap gap-5">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Date</label>
            <input
              type="date"
              value={date}
              min={toDateInputValue(new Date())}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Time</label>
            <select value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary">
              {timeOptions.length === 0 && <option value="">No slots today</option>}
              {timeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Guests</label>
          <select value={guests} onChange={(e) => setGuests(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} guest{n > 1 ? "s" : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Mobile number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07…"
            type="tel"
            className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Special requests (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="High chair, allergies, occasion…"
            className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        {msg && <p className="text-sm text-primary">{msg}</p>}
        <button
          onClick={submit}
          disabled={saving}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Requesting…" : "Request booking"}
        </button>
      </div>

      <div className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">My bookings</div>
      <div className="rounded-2xl border border-border bg-surface px-4 shadow-sm">
        {loading ? null : bookings.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <span className="mb-1.5 block text-2xl">📅</span>
            No bookings yet.
          </div>
        ) : (
          bookings.map((b) => (
            <div key={b.id} className="border-b border-border py-3.5 text-sm last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{b.party_size} guest{b.party_size > 1 ? "s" : ""}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${statusTone[b.status] || "bg-muted text-muted-foreground"}`}>
                  {statusLabel[b.status] || b.status}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {fmtDate(b.reservation_date)} · {fmtTime(b.reservation_time)}
              </div>
              {b.notes && <div className="mt-1.5 text-[13px]">{b.notes}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
