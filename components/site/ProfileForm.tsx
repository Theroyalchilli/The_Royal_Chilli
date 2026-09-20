"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidUkMobile } from "@/lib/utils";

export default function ProfileForm({
  initialFirstName,
  initialLastName,
  initialPhone,
  email,
}: {
  initialFirstName: string;
  initialLastName: string;
  initialPhone: string;
  email: string;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError("");
    setSavedAt(null);
    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }
    if (phone.trim() && !isValidUkMobile(phone)) {
      setError("Please enter a valid UK mobile number (starts with 07, 11 digits)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          phone: phone.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className="w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            className="w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Mobile number (07…)"
          type="tel"
          inputMode="numeric"
          maxLength={11}
          className="w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Email</label>
          <input
            value={email}
            disabled
            className="w-full border border-border bg-surface-hover/40 px-3 py-2.5 text-sm text-muted-foreground outline-none"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {savedAt && <p className="text-sm text-primary">Saved.</p>}
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-primary py-3 text-xs uppercase tracking-[0.15em] text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
