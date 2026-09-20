"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      router.push("/account");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-24">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Welcome Back</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl">
          Sign in to <span className="italic text-primary">your account</span>
        </h1>
      </div>

      <div className="mt-8 space-y-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className="w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
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
          {saving ? "Signing in…" : "Sign In"}
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href="/account/forgot-password" className="text-muted-foreground underline underline-offset-4">
          Forgot password?
        </Link>
        <Link href="/account/signup" className="text-primary underline underline-offset-4">
          Create account
        </Link>
      </div>
    </div>
  );
}
