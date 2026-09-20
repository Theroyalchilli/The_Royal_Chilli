"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!email.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/account/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/95 via-primary to-foreground px-6 py-10 text-primary-foreground">
      <div className="mx-auto max-w-sm">
        <div className="text-center">
          <Image src="/logo.png" alt="The Royal Chilli" width={72} height={72} className="mx-auto rounded-2xl object-cover shadow-lg" />
          <h1 className="mt-4 font-[family-name:var(--font-playfair)] text-3xl">Reset your password</h1>
          <p className="mt-1 text-sm text-primary-foreground/70">Enter your email and we&apos;ll send you a reset link.</p>
        </div>

        <div className="mt-7 rounded-2xl border border-amber-300/20 bg-white/5 p-5 backdrop-blur">
          {sent ? (
            <p className="text-center text-sm text-primary-foreground/90">
              If that email has an account, a reset link is on its way — check your inbox.
            </p>
          ) : (
            <>
              <div className="mb-1">
                <label className="mb-1 block text-xs text-primary-foreground/70">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@email.com"
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  className="w-full rounded-xl border border-amber-300/25 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-amber-300"
                />
              </div>
              <button
                onClick={submit}
                disabled={saving}
                className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-bold text-primary hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Sending…" : "Send reset link"}
              </button>
            </>
          )}

          <p className="mt-3 text-center text-xs text-primary-foreground/70">
            <Link href="/account/login" className="underline">Back to login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
