"use client";

import { useEffect, useState } from "react";

type Member = { id: number; name: string; phone: string | null; email: string | null; loyalty_points: number };
type Conflict = { phoneMember: Member; emailMember: Member };

// Payment screen: put a Rewards Club member on the bill so it earns points —
// find them by phone/email, or join them up there and then (full welcome:
// sign-up points + 20% off their next dine-in visit).
export default function MemberPanel({
  orderIds,
  onLinked,
}: {
  orderIds: number[];
  onLinked: (member: Member, joined: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"find" | "join">("find");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<Conflict | null>(null);

  // search as they type (debounced)
  useEffect(() => {
    if (mode !== "find" || q.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/loyalty/members?q=${encodeURIComponent(q.trim())}`);
        const d = await res.json();
        setResults(d.members ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, mode]);

  async function link(m: Member) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/loyalty/members/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: m.id, order_ids: orderIds }),
      });
      const d = await res.json();
      if (!res.ok) return setError(d.error || "Couldn't link the member");
      onLinked(d.member, false);
    } finally {
      setBusy(false);
    }
  }

  async function join(useCustomerId?: number) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/loyalty/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, marketing_consent: consent, order_ids: orderIds, use_customer_id: useCustomerId }),
      });
      const d = await res.json();
      if (res.status === 409 && d.conflict) return setConflict(d.conflict);
      if (!res.ok) return setError(d.error || "Couldn't join them up");
      setConflict(null);
      onLinked(d.member, !d.already_member);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
      >
        🎁 Add Rewards Club member
      </button>
    );
  }

  const input = "w-full rounded-lg border border-border bg-surface-hover px-2.5 py-2 text-sm text-foreground placeholder-gray-500 focus:border-rose-400 focus:outline-none";
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-foreground">
      <div className="mb-2 flex items-center gap-1 text-xs">
        <button onClick={() => { setMode("find"); setError(""); }} className={`flex-1 rounded-md py-1.5 font-semibold ${mode === "find" ? "bg-rose-600 text-white" : "text-rose-700"}`}>Find member</button>
        <button onClick={() => { setMode("join"); setError(""); if (/^\+?\d[\d\s]+$/.test(q.trim())) setPhone(q.trim()); }} className={`flex-1 rounded-md py-1.5 font-semibold ${mode === "join" ? "bg-rose-600 text-white" : "text-rose-700"}`}>Join now</button>
        <button onClick={() => setOpen(false)} className="px-2 text-rose-700" aria-label="Close">✕</button>
      </div>

      {mode === "find" ? (
        <>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Phone or email" className={input} />
          <div className="mt-1.5 space-y-1">
            {searching && <p className="text-[11px] text-muted-foreground">Searching…</p>}
            {!searching && q.trim().length >= 3 && results.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No member found — tap Join now to sign them up.</p>
            )}
            {results.map((m) => (
              <button
                key={m.id}
                onClick={() => link(m)}
                disabled={busy}
                className="flex w-full items-center justify-between rounded-md bg-white px-2 py-1.5 text-left text-xs hover:bg-rose-100 disabled:opacity-50"
              >
                <span>
                  <b>{m.name}</b>
                  <span className="text-muted-foreground"> · {m.phone || m.email}</span>
                </span>
                <span className="font-semibold text-rose-700">{m.loyalty_points} pts</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={input} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" inputMode="tel" className={input} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (their welcome voucher goes here)" type="email" className={input} />
          <label className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>They&apos;re happy to get offers &amp; rewards by email</span>
          </label>
          {conflict ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px]">
              <p className="font-semibold text-amber-800">⚠️ These belong to two different people — which is it?</p>
              {[
                { label: conflict.phoneMember.phone ?? "mobile", m: conflict.phoneMember },
                { label: conflict.emailMember.email ?? "email", m: conflict.emailMember },
              ].map(({ label, m }) => (
                <button
                  key={m.id}
                  onClick={() => join(m.id)}
                  disabled={busy}
                  className="mt-1 flex w-full items-center justify-between rounded bg-white px-2 py-1.5 text-left hover:bg-amber-100 disabled:opacity-50"
                >
                  <span>{label} → <b>{m.name}</b></span>
                  <span className="text-rose-700">{m.loyalty_points} pts · Use</span>
                </button>
              ))}
              <button onClick={() => setConflict(null)} className="mt-1 w-full text-center text-muted-foreground underline">Cancel</button>
            </div>
          ) : (
            <button onClick={() => join()} disabled={busy || !name.trim() || !phone.trim() || !email.trim()} className="w-full rounded-lg bg-rose-600 py-2 text-xs font-bold text-white disabled:opacity-50">
              {busy ? "Joining…" : "Join & add to this bill"}
            </button>
          )}
          <p className="text-[10px] text-muted-foreground">They get 200 points now and 20% off their next dine-in visit.</p>
        </div>
      )}
      {error && <p className="mt-1.5 text-[11px] font-semibold text-red-600">{error}</p>}
    </div>
  );
}
