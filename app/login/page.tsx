"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (res.ok) {
        // Employees work the till; manager/hr/admin land straight on the
        // role-based Staff Hub welcome screen instead of going via /pos.
        router.push(data.user?.role === "employee" ? "/pos" : "/staff");
      } else {
        setError(data.error || "Invalid username or password");
        setPassword("");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const timeStr = currentTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = currentTime.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <Image src="/logo.png" alt="The Royal Chilli" width={56} height={56} className="rounded-xl object-cover flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-wide leading-tight" style={{ fontFamily: "var(--font-cinzel)" }}>
              Welcome to
            </h1>
            <h1 className="text-2xl font-bold text-primary tracking-wide leading-tight" style={{ fontFamily: "var(--font-cinzel)" }}>
              Royal Chilli
            </h1>
          </div>
        </div>

        <form onSubmit={handleLogin} className="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)]">
          <div>
            <label htmlFor="username" className="block text-sm font-semibold text-muted-foreground mb-1.5">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-surface-hover border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-muted-foreground mb-1.5">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-hover border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-red-500"
            />
          </div>

          {error && (
            <div className="bg-red-100 border border-red-300 rounded-xl p-3 text-center text-red-700 text-sm" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="pos-btn no-select w-full h-12 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-base font-bold rounded-xl transition-all"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link href="/pos" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
            ← Back to POS
          </Link>
        </div>

        <div className="mt-8 text-center">
          <p className="text-foreground text-lg font-mono font-semibold tracking-widest" suppressHydrationWarning>{timeStr}</p>
          <p className="text-muted-foreground text-xs mt-0.5" suppressHydrationWarning>{dateStr}</p>
          <p className="text-muted-foreground text-xs mt-3">43 Kingsley Road, Hounslow TW3 1PA</p>
        </div>
      </div>
    </div>
  );
}
