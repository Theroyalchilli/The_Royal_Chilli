"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeUkMobile } from "@/lib/phone";

// Every account needs a mobile (one customer, one record): it's how staff
// find your points when you dine in. Shown instead of the account pages until
// one is added.
export default function AddMobileGate() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!normalizeUkMobile(mobile)) return setError("Please enter a UK mobile number (starts with 07)");
    setBusy(true);
    setError("");
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: mobile }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error || "Couldn't save your number");
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface px-5 py-6 text-center shadow-sm">
      <div className="text-3xl">📱</div>
      <h1 className="mt-2 font-[family-name:var(--font-playfair)] text-2xl">Add your mobile number</h1>
      <p className="mt-2 text-sm text-muted-foreground">So we can find your points when you dine in with us. If you&apos;ve given it to us before, your past visits and points will join your account.</p>
      <input
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        type="tel"
        inputMode="tel"
        placeholder="07…"
        className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-3 text-center text-lg tracking-wider"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button onClick={save} disabled={busy} className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
