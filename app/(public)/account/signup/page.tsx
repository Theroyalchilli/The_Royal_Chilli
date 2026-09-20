"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError("");
    if (!name.trim() || !email.trim() || !password) {
      setError("Name, email and password are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
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
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Create Account</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl">
          Join <span className="italic text-primary">The Royal Chilli</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Track orders, save addresses, and earn loyalty points.</p>
      </div>

      <div className="mt-8 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
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
          placeholder="Password (min. 8 characters)"
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
          {saving ? "Creating account…" : "Create Account"}
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/account/login" className="text-primary underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
