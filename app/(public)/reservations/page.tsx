"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { siteContent } from "@/lib/site-content";
import Reveal from "@/components/site/Reveal";

// wa.me only opens a pre-filled draft — the customer still has to tap Send
// themselves — since actually auto-sending would need a WhatsApp Business
// API account we don't have set up. This is the no-setup stand-in for that:
// one tap, right after they've already engaged with the booking flow.
function buildWhatsAppReservationLink({
  waitlisted, name, phone, guests, date, time, notes,
}: { waitlisted: boolean; name: string; phone: string; guests: number; date: string; time: string; notes: string }) {
  let dateLabel = date;
  let timeLabel = time;
  try {
    const d = new Date(`${date}T${time}:00`);
    dateLabel = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    timeLabel = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    // keep the raw strings if parsing fails
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fullMessage, setFullMessage] = useState("");

  // SumUp's Hosted Checkout only has one redirect_url (no separate
  // success/cancel destinations like Stripe had), so on return we check the
  // real deposit status rather than assume the redirect means it was paid.
  useEffect(() => {
    if (depositRedirect !== "return" || !depositReservationId) return;
    fetch(`/api/public/reservations/${depositReservationId}`)
      .then((r) => r.json())
      .then((d) => setDepositPaid(!!d.paid))
      .catch(() => setDepositPaid(false));
  }, [depositRedirect, depositReservationId]);

  async function submit(joinWaitlist = false) {
    setError("");
    setFullMessage("");
    if (!name.trim() || !phone.trim() || !date || !time) {
      setError("Please fill in your name, phone, date and time.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_email: email.trim() || undefined,
          reservation_date: date,
          reservation_time: time,
          party_size: guests,
          notes: notes.trim() || undefined,
          join_waitlist: joinWaitlist || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to book");
      if (data.full) {
        setFullMessage(data.message);
        return;
      }

      if (data.deposit_amount > 0) {
        const sessionRes = await fetch(`/api/public/reservations/${data.id}/checkout-session`, { method: "POST" });
        const sessionData = await sessionRes.json();
        if (sessionRes.ok && sessionData.url) {
          window.location.href = sessionData.url;
          return;
        }
      }

      // Instant same-tab redirect straight into WhatsApp, message pre-filled
      // — not a new tab, since a popup opened after this async request would
      // likely get blocked as no longer tied to the click that started it.
      // No confirmation screen shown here: the customer never sees one
      // before leaving for WhatsApp, per explicit instruction.
      window.location.href = buildWhatsAppReservationLink({
        waitlisted: !!data.waitlisted, name, phone, guests, date, time, notes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
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
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full border border-border bg-background px-4 py-2.5 outline-none focus:border-primary"
          />
        </div>
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

      {fullMessage ? (
        <div className="mt-6 border border-amber-500/40 bg-amber-500/10 p-4 text-center">
          <p className="text-sm text-amber-600">{fullMessage}</p>
          <button
            onClick={() => submit(true)}
            disabled={submitting}
            className="mt-3 w-full bg-primary px-6 py-3 text-xs uppercase tracking-[0.15em] text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Joining…" : "Join Waitlist"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => submit(false)}
          disabled={submitting}
          className="mt-6 w-full bg-primary px-6 py-3 text-xs uppercase tracking-[0.15em] text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Booking…" : "Book Table"}
        </button>
      )}
    </div>
  );
}
