"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const STAFF_NAMES = ["Suresh", "Manager", "Cashier", "Kitchen"];

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-500",
  manager: "bg-blue-500",
  cashier: "bg-green-500",
  kitchen: "bg-red-500",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  kitchen: "Kitchen Staff",
};

export default function LoginPage() {
  const router = useRouter();
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Seed database on first load
    fetch("/api/seed", { method: "POST" }).catch(console.error);

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError("");
      if (newPin.length === 4 && selectedName) {
        handleLogin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
    setError("");
  };

  const handleClear = () => {
    setPin("");
    setError("");
  };

  const handleLogin = async (pinValue: string) => {
    if (!selectedName) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedName, pin: pinValue }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/pos");
      } else {
        setError(data.error || "Login failed");
        setPin("");
      }
    } catch {
      setError("Connection error. Please try again.");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const timeStr = currentTime.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = currentTime.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
            <span className="text-2xl">🌶️</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-orange-400 tracking-tight">
              The Royal Chilli
            </h1>
            <p className="text-gray-400 text-sm">43 Kingsley Road, Hounslow TW3 1PA</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-3xl font-mono font-bold text-white">{timeStr}</p>
          <p className="text-gray-400 text-sm">{dateStr}</p>
        </div>
      </div>

      <div className="w-full max-w-md">
        {/* Staff Selection */}
        {!selectedName ? (
          <div>
            <h2 className="text-center text-gray-300 text-lg font-medium mb-4">
              Select Your Name
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {STAFF_NAMES.map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedName(name)}
                  className="pos-btn no-select bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl p-6 text-center transition-all duration-150 active:scale-95"
                >
                  <div className="text-4xl mb-2">
                    {name === "Suresh" ? "👑" : name === "Manager" ? "🎯" : name === "Cashier" ? "💰" : "🍳"}
                  </div>
                  <div className="text-white font-semibold text-lg">{name}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {/* Back button */}
            <button
              onClick={() => { setSelectedName(null); setPin(""); setError(""); }}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
            >
              <span>←</span> Back to staff selection
            </button>

            {/* Staff info */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4 text-center">
              <div className="text-2xl mb-1">
                {selectedName === "Suresh" ? "👑" : selectedName === "Manager" ? "🎯" : selectedName === "Cashier" ? "💰" : "🍳"}
              </div>
              <div className="text-white text-xl font-bold">{selectedName}</div>
            </div>

            {/* PIN display */}
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${
                    i < pin.length
                      ? "bg-orange-500 border-orange-400"
                      : "bg-gray-800 border-gray-600"
                  }`}
                >
                  {i < pin.length && (
                    <div className="w-3 h-3 bg-white rounded-full" />
                  )}
                </div>
              ))}
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4 text-center text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* PIN Pad */}
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handlePinInput(String(digit))}
                  disabled={loading}
                  className="pos-btn no-select h-16 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border border-gray-600 rounded-xl text-white text-2xl font-bold transition-all disabled:opacity-50"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={handleClear}
                disabled={loading}
                className="pos-btn no-select h-16 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border border-gray-600 rounded-xl text-gray-400 text-sm font-semibold transition-all disabled:opacity-50"
              >
                CLR
              </button>
              <button
                onClick={() => handlePinInput("0")}
                disabled={loading}
                className="pos-btn no-select h-16 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border border-gray-600 rounded-xl text-white text-2xl font-bold transition-all disabled:opacity-50"
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                disabled={loading}
                className="pos-btn no-select h-16 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border border-gray-600 rounded-xl text-gray-400 text-xl font-semibold transition-all disabled:opacity-50"
              >
                ⌫
              </button>
            </div>

            {/* Enter button */}
            <button
              onClick={() => handleLogin(pin)}
              disabled={pin.length !== 4 || loading}
              className="pos-btn no-select w-full mt-3 h-14 bg-orange-500 hover:bg-orange-400 disabled:bg-gray-700 disabled:text-gray-500 text-white text-lg font-bold rounded-xl transition-all disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "SIGN IN"}
            </button>
          </div>
        )}
      </div>

      <p className="mt-8 text-gray-600 text-xs">
        The Royal Chilli POS v1.0 • South &amp; North Indian Restaurant
      </p>
    </div>
  );
}
