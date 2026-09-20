"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function AuthForm() {
  const router = useRouter();
  const initialMode = useSearchParams().get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/account/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { name, email, password, marketingConsent } : { email, password }),
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
    <div className="min-h-screen bg-gradient-to-b from-primary/95 via-primary to-foreground px-6 py-10 text-primary-foreground">
      <div className="mx-auto max-w-sm">
        <div className="text-center">
          <Image src="/logo.png" alt="The Royal Chilli" width={72} height={72} className="mx-auto rounded-2xl object-cover shadow-lg" />
          <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/40 px-3.5 py-1.5 text-xs text-amber-200">
            The Royal Chilli · Hounslow
          </span>
          <h1 className="mt-4 font-[family-name:var(--font-playfair)] text-3xl">My Account</h1>
          <p className="mt-1 text-sm text-primary-foreground/70">Order, earn points and book a table — all in one place.</p>
        </div>

        <div className="mt-7 rounded-2xl border border-amber-300/20 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex rounded-xl bg-black/25 p-1">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === "login" ? "bg-primary text-primary-foreground" : "text-primary-foreground/70"}`}
            >
              Log in
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-primary-foreground/70"}`}
            >
              Sign up
            </button>
          </div>

          {mode === "signup" && (
            <div className="mb-3">
              <label className="mb-1 block text-xs text-primary-foreground/70">Full name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
                className="w-full rounded-xl border border-amber-300/25 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-amber-300"
              />
            </div>
          )}
          <div className="mb-3">
            <label className="mb-1 block text-xs text-primary-foreground/70">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@email.com"
              className="w-full rounded-xl border border-amber-300/25 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-amber-300"
            />
          </div>
          <div className="mb-1">
            <label className="mb-1 block text-xs text-primary-foreground/70">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full rounded-xl border border-amber-300/25 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-amber-300"
            />
          </div>
          {mode === "signup" && (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs text-primary-foreground/70">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-amber-300/40 bg-white/5 accent-primary"
              />
              Send me offers, news and updates from The Royal Chilli. You can unsubscribe any time.
            </label>
          )}
          {error && <p className="mt-2 text-xs text-red-200">{error}</p>}

          <button
            onClick={submit}
            disabled={saving}
            className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-bold text-primary hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>

          {mode === "login" && (
            <p className="mt-3 text-center text-xs text-primary-foreground/70">
              <Link href="/account/forgot-password" className="underline">Forgot password?</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AccountLoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}
