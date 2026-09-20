"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setError("");
    if (!token) {
      setError("This reset link is missing its token — please request a new one");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/account/login"), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-24">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Reset Password</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl">Choose a new password</h1>
      </div>

      {done ? (
        <p className="mt-8 text-center text-sm">Password updated — taking you to login…</p>
      ) : (
        <div className="mt-8 space-y-3">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            type="password"
            className="w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            type="password"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={submit}
            disabled={saving}
            className="w-full bg-primary py-3 text-xs uppercase tracking-[0.15em] text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save New Password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
