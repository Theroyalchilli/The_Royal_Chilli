"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { siteContent } from "@/lib/site-content";
import Reveal from "@/components/site/Reveal";
import { getScheduleSlotOptions, toDateInputValue } from "@/lib/hours";

// wa.me only opens a pre-filled draft — the customer still has to tap Send
// themselves — since actually auto-sending would need a WhatsApp Business
// API account we don't have set up. This is the no-setup stand-in for that:
// one tap, right after they've already engaged with the booking flow.
function buildWhatsAppReservationLink({
  waitlisted, name, phone, guests, time, notes,
}: { waitlisted: boolean; name: string; phone: string; guests: number; time: string; notes: string }) {
  // `time` is already a full local "YYYY-MM-DDTHH:MM" from the slot <select>
  // — not just a time — since a post-midnight slot actually falls on the day
  // after the date the customer picked (see getScheduleSlotOptions).
  let dateLabel = time;
  let timeLabel = time;
  try {
    const d = new Date(`${time}:00`);
    dateLabel = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    timeLabel = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    // keep the raw string if parsing fails
  }
  const lines = [
    waitlisted ? "⏳ Waitlist Request — The Royal Chilli" : "🍽️ New Reservation Request — The Royal Chilli",
    "",
    `👤 Name: ${name}`,
    `📞 Phone: ${phone}`,
    `👥 Party size: ${guests}`,
    `📅 Date: ${dateLabel}`,
    `🕐 Time: ${timeLabel}`,
  ];
  if (notes.trim()) lines.push(`📝 Notes: ${notes.trim()}`);
  return `https://wa.me/${siteContent.contact.waNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export default function ReservationsPage() {
  return (
    <Suspense>
      <ReservationsForm />
    </Suspense>
  );
}

function ReservationsForm() {
  const { reservation, contact } = siteContent;
  const searchParams = useSearchParams();
  const depositRedirect = searchParams.get("deposit");
  const depositReservationId = searchParams.get("reservation_id");
  const [depositPaid, setDepositPaid] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  // Every valid quarter-hour slot for the chosen date, restricted to that
  // day's real opening hours (9am–1am) — same helper the checkout page uses
  // for "Schedule for later", so a customer can never pick a time we're shut.
  const timeSlots = date ? getScheduleSlotOptions(new Date(`${date}T00:00:00`)) : [];

  // Keep the selected time inside the current date's valid slots — e.g.
  // changing the date could otherwise leave a stale slot the new day doesn't offer.
  useEffect(() => {
    if (timeSlots.length > 0 && !timeSlots.some((s) => s.value === time)) {
      setTime(timeSlots[0].value);
    } else if (timeSlots.length === 0 && time) {
      setTime("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // SumUp's Hosted Checkout only has one redirect_url (no separate
  // success/cancel destinations like Stripe had), so on return we check the
  // real deposit status rather than assume the redirect means it was paid.
  // (Dormant while bookings aren't saved to the database — see submit().)
  useEffect(() => {
    if (depositRedirect !== "return" || !depositReservationId) return;
    fetch(`/api/public/reservations/${depositReservationId}`)
      .then((r) => r.json())
      .then((d) => setDepositPaid(!!d.paid))
      .catch(() => setDepositPaid(false));
  }, [depositRedirect, depositReservationId]);

  // Nothing is saved to the database for now (per explicit instruction, until
  // told otherwise) — so there's no deposit check and no fully-booked/waitlist
  // check either, since both depend on a stored reservation. This just
  // validates the form client-side and redirects straight into WhatsApp.
  function submit() {
    setError("");
    if (!name.trim() || !phone.trim() || !date || !time) {
      setError("Please fill in your name, phone, date and time.");
      return;
    }
    // Instant same-tab redirect straight into WhatsApp, message pre-filled
    // — not a new tab, since a popup opened outside a direct click handler
    // would likely get blocked. No confirmation screen shown here.
    window.location.href = buildWhatsAppReservationLink({
      waitlisted: false, name, phone, guests, time, notes,
    });
  }

  if (depositRedirect === "return") {
    if (depositPaid === null) {
      return <div className="mx-auto max-w-md px-4 py-24 text-center text-muted-foreground">Checking payment status…</div>;
    }
    if (depositPaid) {
      return (
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <div className="text-5xl">✅</div>
          <h1 className="mt-4 font-[family-name:var(--font-playfair)] text-2xl">Deposit Paid — Table Confirmed!</h1>
          <p className="mt-2 text-muted-foreground">We'll see you soon. Questions? Call us on {contact.phone}.</p>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="text-5xl">⚠️</div>
        <h1 className="mt-4 font-[family-name:var(--font-playfair)] text-2xl">Deposit Payment Not Completed</h1>
        <p className="mt-2 text-muted-foreground">
          Your booking request is still held, but the deposit hasn&apos;t been paid yet. Call us on {contact.phone} to sort this out, or try booking again.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Reveal className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">{reservation.tag}</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-4xl">
          {reservation.title} <span className="italic text-primary">{reservation.titleGold}</span>
        </h1>
        <p className="mt-3 text-muted-foreground">{reservation.desc}</p>
      </Reveal>

      <div className="mt-10 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          className="w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional, for confirmation)"
          type="email"
          className="w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
        />
        <div className="grid grid-cols-2 gap-3">
          {/* Native date/time inputs ignore the placeholder attribute on
              mobile, so an empty box gives no hint of the expected format
              until tapped — a plain text label above each fixes that. */}
          <label className="block text-left">
            <span className="text-xs text-muted-foreground">Date</span>
            <input
              type="date"
              value={date}
              min={toDateInputValue(new Date())}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
            />
          </label>
          <label className="block text-left">
            <span className="text-xs text-muted-foreground">Time</span>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={!date}
              className="mt-1 w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary disabled:opacity-50"
            >
              {!date ? (
                <option value="">Pick a date first</option>
              ) : timeSlots.length === 0 ? (
                <option value="">No slots left that day</option>
              ) : (
                timeSlots.map((slot) => (
                  <option key={slot.value} value={slot.value}>{slot.label}</option>
                ))
              )}
            </select>
          </label>
        </div>
        {date && timeSlots.length === 0 && (
          <p className="text-xs text-red-500">No more slots that day — please choose a different date.</p>
        )}
        <div className="flex items-center justify-between border border-border px-4 py-2.5">
          <span className="text-sm text-muted-foreground">Number of guests</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setGuests((g) => Math.max(1, g - 1))} className="h-9 w-9 border border-border">−</button>
            <span className="w-4 text-center">{guests}</span>
            <button onClick={() => setGuests((g) => g + 1)} className="h-9 w-9 border border-border">+</button>
          </div>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Special requests (optional)"
          rows={3}
          className="w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <button
        onClick={submit}
        className="mt-6 w-full bg-primary px-6 py-3 text-xs uppercase tracking-[0.15em] text-primary-foreground hover:opacity-90"
      >
        Book Table
      </button>
    </div>
  );
}
