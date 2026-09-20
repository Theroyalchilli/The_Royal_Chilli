"use client";

import { useState } from "react";
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
    <div className="mx-auto max-w-sm px-4 py-24">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Reset Password</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl">Forgot your password?</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
      </div>

      {sent ? (
        <p className="mt-8 text-center text-sm">
          If that email has an account, a reset link is on its way — check your inbox.
        </p>
      ) : (
        <div className="mt-8 space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={submit}
            disabled={saving}
            className="w-full bg-primary py-3 text-xs uppercase tracking-[0.15em] text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Sending…" : "Send Reset Link"}
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/account/login" className="text-primary underline underline-offset-4">
          Back to login
        </Link>
      </p>
    </div>
  );
}
