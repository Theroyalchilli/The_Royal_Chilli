"use client";

import { useEffect, useState } from "react";

type Matrix = Record<string, Record<string, boolean>>;
const FIXED = new Set(["admin", "employee"]); // admin always on, employee always off

function PermissionsPanel({ canEdit }: { canEdit: boolean }) {
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [tabs, setTabs] = useState<string[]>([]);
  const [tabLabels, setTabLabels] = useState<Record<string, string>>({});
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function load() {
    fetch("/api/permissions").then((r) => r.json()).then((d) => {
      setMatrix(d.matrix);
      setRoles(d.roles || []);
      setTabs(d.tabs || []);
      setTabLabels(d.tabLabels || {});
      setRoleLabels(d.roleLabels || {});
    });
  }

  useEffect(() => { load(); }, []);

  async function toggle(role: string, tab: string, current: boolean) {
    if (!canEdit || FIXED.has(role)) return;
    const cellKey = `${role}:${tab}`;
    setSaving(cellKey);
    setMatrix((m) => (m ? { ...m, [tab]: { ...m[tab], [role]: !current } } : m));
    const res = await fetch("/api/permissions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, permission: tab, granted: !current }),
    });
    if (!res.ok) setMatrix((m) => (m ? { ...m, [tab]: { ...m[tab], [role]: current } } : m));
    setSaving(null);
  }

  if (!matrix) return <div className="text-muted-foreground text-sm py-6">Loading permissions…</div>;

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] p-5">
      <h2 className="text-foreground font-bold text-lg">Roles &amp; Permissions</h2>
      <p className="mt-1 text-muted-foreground text-xs">
        Which roles can open each Staff Hub tab. Admin always has everything; employees never see Staff Hub — neither is editable.
        {!canEdit && " Only an Admin can change this."}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left text-muted-foreground font-semibold p-2 sticky left-0 bg-surface">Tab</th>
              {roles.map((role) => (
                <th key={role} className="text-muted-foreground font-semibold p-2 text-center whitespace-nowrap">
                  {roleLabels[role] || role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabs.map((tab) => (
              <tr key={tab} className="border-t border-border">
                <td className="p-2 text-foreground sticky left-0 bg-surface max-w-[220px]">{tabLabels[tab] || tab}</td>
                {roles.map((role) => {
                  const granted = matrix[tab]?.[role] ?? false;
                  const fixed = FIXED.has(role);
                  const cellKey = `${role}:${tab}`;
                  return (
                    <td key={role} className="p-2 text-center">
                      <button
                        disabled={!canEdit || fixed || saving === cellKey}
                        onClick={() => toggle(role, tab, granted)}
                        className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                          granted ? "bg-red-600 border-red-500 text-white" : "bg-surface-hover border-border text-transparent"
                        } ${!canEdit || fixed ? "opacity-60 cursor-not-allowed" : "hover:border-red-500 cursor-pointer"}`}
                        title={fixed ? `${roleLabels[role]} access is fixed` : undefined}
                      >
                        {granted ? "✓" : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 3000); }}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg"
          >
            Save Permissions
          </button>
          {saved && <span className="text-emerald-600 text-sm font-semibold">✓ Saved</span>}
          <span className="text-muted-foreground text-xs">Each toggle above saves the instant you click it — this just confirms everything's up to date.</span>
        </div>
      )}
    </div>
  );
}

export default function SettingsView({ canEditPermissions }: { canEditPermissions: boolean }) {
  const [tab, setTab] = useState<"general" | "permissions">("general");
  const [companyName, setCompanyName] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [weekStartDay, setWeekStartDay] = useState("Monday");
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [vatRate, setVatRate] = useState("0.2");
  const [maxEmployees, setMaxEmployees] = useState("20");
  const [depositAmount, setDepositAmount] = useState("0");
  const [openingHours, setOpeningHours] = useState<{ day: string; open: string; close: string }[]>([]);
  const [aboutExcerpt, setAboutExcerpt] = useState({ title: "", titleGold: "", text1: "", text2: "" });
  const [storyParagraphs, setStoryParagraphs] = useState<string[]>([]);
  const [readerId, setReaderId] = useState("");
  const [regCode, setRegCode] = useState("");
  const [readerName, setReaderName] = useState("Reception");
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState("");
  const [pairedStatus, setPairedStatus] = useState("");
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [restaurantLat, setRestaurantLat] = useState("");
  const [restaurantLng, setRestaurantLng] = useState("");
  const [geofenceRadius, setGeofenceRadius] = useState("150");
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const s = d.settings || {};
        if (s.company_name) setCompanyName(s.company_name);
        if (s.currency) setCurrency(s.currency);
        if (s.week_start_day) setWeekStartDay(s.week_start_day);
        setOvertimeEnabled(!!s.overtime_enabled);
        if (s.vat_rate !== undefined) setVatRate(String(s.vat_rate));
        if (s.max_employees !== undefined) setMaxEmployees(String(s.max_employees));
        if (s.reservation_deposit_amount !== undefined) setDepositAmount(String(s.reservation_deposit_amount));
        if (Array.isArray(s.opening_hours)) setOpeningHours(s.opening_hours);
        if (s.about_excerpt) setAboutExcerpt(s.about_excerpt);
        if (Array.isArray(s.our_story_paragraphs)) setStoryParagraphs(s.our_story_paragraphs);
        if (s.stripe_terminal_reader_id !== undefined) setReaderId(String(s.stripe_terminal_reader_id));
        setGeofenceEnabled(!!s.geofence_enabled);
        if (s.restaurant_latitude != null) setRestaurantLat(String(s.restaurant_latitude));
        if (s.restaurant_longitude != null) setRestaurantLng(String(s.restaurant_longitude));
        if (s.geofence_radius_meters !== undefined) setGeofenceRadius(String(s.geofence_radius_meters));
      })
      .finally(() => setLoading(false));
  }, []);

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRestaurantLat(pos.coords.latitude.toFixed(6));
        setRestaurantLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function pairReader() {
    setPairing(true);
    setPairError("");
    setPairedStatus("");
    try {
      const res = await fetch("/api/pos/terminal/pair", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_code: regCode.trim(), label: readerName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setPairError(data.error || "Failed to pair reader"); return; }
      setReaderId(data.reader.id);
      setPairedStatus(`Paired — status: ${data.reader.status ?? "registered"}. Click Save below to store it.`);
      setRegCode("");
    } finally {
      setPairing(false);
    }
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: companyName, currency, week_start_day: weekStartDay, overtime_enabled: overtimeEnabled,
        vat_rate: Number(vatRate), max_employees: Number(maxEmployees),
        reservation_deposit_amount: Number(depositAmount),
        opening_hours: openingHours,
        about_excerpt: aboutExcerpt,
        our_story_paragraphs: storyParagraphs,
        stripe_terminal_reader_id: readerId.trim(),
        geofence_enabled: geofenceEnabled,
        restaurant_latitude: restaurantLat ? Number(restaurantLat) : null,
        restaurant_longitude: restaurantLng ? Number(restaurantLng) : null,
        geofence_radius_meters: Number(geofenceRadius) || 150,
      }),
    });
    setSaving(false);
    setSaved(true);
  }

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 style={{ fontFamily: "var(--font-space-grotesk)" }} className="text-foreground text-[22px] font-semibold tracking-[-0.02em]">Settings</h1>
              <p className="text-muted-foreground text-sm">Restaurant-wide configuration — roles, permissions and more.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-b border-border">
            <button
              onClick={() => setTab("general")}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === "general" ? "text-red-600 border-red-500" : "text-muted-foreground border-transparent hover:text-foreground"}`}
            >
              General
            </button>
            <button
              onClick={() => setTab("permissions")}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === "permissions" ? "text-red-600 border-red-500" : "text-muted-foreground border-transparent hover:text-foreground"}`}
            >
              Roles &amp; Permissions
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        {tab === "general" ? (
          <div className="mt-6 max-w-md rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(32,27,24,0.04),0_8px_24px_rgba(32,27,24,0.05)] p-5 space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Company Name</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
                <option value="GBP">£ GBP</option>
                <option value="EUR">€ EUR</option>
                <option value="USD">$ USD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Week Start Day</label>
              <select value={weekStartDay} onChange={(e) => setWeekStartDay(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
                <option value="Monday">Monday</option>
                <option value="Sunday">Sunday</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">VAT Rate</label>
              <select value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
                <option value="0.2">20% (Standard)</option>
                <option value="0.05">5% (Reduced)</option>
                <option value="0">0% (Zero-rated)</option>
              </select>
              <p className="mt-1 text-muted-foreground text-xs">Used by Finance → VAT report to extract VAT from your VAT-inclusive menu prices.</p>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Employee Limit</label>
              <input type="number" value={maxEmployees} onChange={(e) => setMaxEmployees(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
              <p className="mt-1 text-muted-foreground text-xs">Blocks adding new employees once this many are active.</p>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Reservation Deposit (£)</label>
              <input type="number" step="0.01" min="0" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
              <p className="mt-1 text-muted-foreground text-xs">0 = no deposit required. When set, new website reservations (not waitlist entries) are redirected to pay this online before confirming.</p>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Opening Hours (displayed on the website)</label>
              <p className="mb-2 text-muted-foreground text-xs">
                Shown in the footer, homepage, FAQ and Google listing data. Doesn&apos;t change what times customers can
                actually place an order — that&apos;s controlled separately.
              </p>
              <div className="space-y-1.5">
                {openingHours.map((h, i) => (
                  <div key={h.day} className="flex items-center gap-2">
                    <span className="w-24 flex-shrink-0 text-xs text-muted-foreground">{h.day}</span>
                    <input
                      type="time" value={h.open}
                      onChange={(e) => setOpeningHours((prev) => prev.map((d, j) => j === i ? { ...d, open: e.target.value } : d))}
                      className="flex-1 bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground text-sm"
                    />
                    <span className="text-muted-foreground text-xs">to</span>
                    <input
                      type="time" value={h.close}
                      onChange={(e) => setOpeningHours((prev) => prev.map((d, j) => j === i ? { ...d, close: e.target.value } : d))}
                      className="flex-1 bg-surface-hover border border-border rounded-lg px-2 py-1.5 text-foreground text-sm"
                    />
                    {i === 0 && (
                      <button
                        type="button"
                        onClick={() => setOpeningHours((prev) => prev.map((d) => ({ ...d, open: prev[0].open, close: prev[0].close })))}
                        title="Apply Monday's hours to every day"
                        className="flex-shrink-0 text-muted-foreground hover:text-foreground text-xs underline"
                      >
                        Copy to all
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-1 text-muted-foreground text-xs">A close time earlier than open (e.g. 09:00 to 01:00) means past midnight.</p>
            </div>

            <div className="pt-2 border-t border-border">
              <label className="block text-xs text-muted-foreground mb-1">Our Story</label>
              <p className="mb-2 text-muted-foreground text-xs">Homepage excerpt and the full story shown on the About page.</p>

              <p className="mt-3 text-xs font-semibold text-foreground">Homepage excerpt</p>
              <input
                placeholder="Heading (black part)" value={aboutExcerpt.title}
                onChange={(e) => setAboutExcerpt((a) => ({ ...a, title: e.target.value }))}
                className="mt-1.5 w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              />
              <input
                placeholder="Heading (gold/italic part)" value={aboutExcerpt.titleGold}
                onChange={(e) => setAboutExcerpt((a) => ({ ...a, titleGold: e.target.value }))}
                className="mt-1.5 w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              />
              <textarea
                placeholder="First paragraph" value={aboutExcerpt.text1} rows={2}
                onChange={(e) => setAboutExcerpt((a) => ({ ...a, text1: e.target.value }))}
                className="mt-1.5 w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              />
              <textarea
                placeholder="Second paragraph" value={aboutExcerpt.text2} rows={2}
                onChange={(e) => setAboutExcerpt((a) => ({ ...a, text2: e.target.value }))}
                className="mt-1.5 w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              />

              <p className="mt-4 text-xs font-semibold text-foreground">Full story (About page)</p>
              <div className="mt-1.5 space-y-2">
                {storyParagraphs.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <textarea
                      value={p} rows={2}
                      onChange={(e) => setStoryParagraphs((prev) => prev.map((x, j) => j === i ? e.target.value : x))}
                      className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setStoryParagraphs((prev) => prev.filter((_, j) => j !== i))}
                      className="flex-shrink-0 text-muted-foreground hover:text-red-600 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setStoryParagraphs((prev) => [...prev, ""])}
                className="mt-2 text-red-600 text-xs font-semibold"
              >
                + Add paragraph
              </button>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Card Reader ID (Stripe Terminal)</label>
              <input type="text" placeholder="tmr_… (from pairing below)" value={readerId} onChange={(e) => setReaderId(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm font-mono" />
              <p className="mt-1 text-muted-foreground text-xs">Leave blank to keep the manual &quot;Card Paid&quot; button (for a separate card machine). Set it to drive a Stripe Reader from the till.</p>
            </div>

            <div className="rounded-lg border border-border bg-surface-hover p-3">
              <p className="text-xs font-semibold text-foreground">Pair a new Stripe Reader</p>
              <p className="mt-1 text-muted-foreground text-xs">
                On the reader, open its settings and choose to connect / generate a pairing code — it shows a
                short registration code (e.g. <span className="font-mono">quick-brown-fox</span>). Enter it here
                within a few minutes. This registers the reader and fills in the Card Reader ID field above.
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text" placeholder="Registration code from the reader" value={regCode}
                  onChange={(e) => setRegCode(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm font-mono"
                />
                <input
                  type="text" placeholder="Label (e.g. Reception)" value={readerName}
                  onChange={(e) => setReaderName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                />
              </div>
              <button
                onClick={pairReader}
                disabled={pairing || !regCode.trim() || !readerName.trim()}
                className="mt-3 px-4 py-2 bg-elevated hover:bg-elevated-hover disabled:opacity-50 text-foreground text-xs font-semibold rounded-lg border border-elevated"
              >
                {pairing ? "Pairing…" : "Pair Reader"}
              </button>
              {pairError && <p className="mt-2 text-red-600 text-xs">{pairError}</p>}
              {pairedStatus && <p className="mt-2 text-emerald-600 text-xs">{pairedStatus}</p>}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-foreground text-sm font-medium">Automatic Overtime</p>
                <p className="text-muted-foreground text-xs">Currently off — all hours pay at the flat rate.</p>
              </div>
              <button onClick={() => setOvertimeEnabled((v) => !v)}
                className={`w-12 h-6 rounded-full transition-colors relative ${overtimeEnabled ? "bg-red-600" : "bg-elevated"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${overtimeEnabled ? "translate-x-6" : ""}`} />
              </button>
            </div>

            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground text-sm font-medium">Geofenced Clock-In</p>
                  <p className="text-muted-foreground text-xs">Blocks self-service clock-in unless staff are near the restaurant. Clock-out is never blocked.</p>
                </div>
                <button onClick={() => setGeofenceEnabled((v) => !v)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${geofenceEnabled ? "bg-red-600" : "bg-elevated"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${geofenceEnabled ? "translate-x-6" : ""}`} />
                </button>
              </div>

              {geofenceEnabled && (
                <div className="mt-3 space-y-3">
                  {(!restaurantLat || !restaurantLng) && (
                    <p className="text-amber-600 text-xs">⚠ Set the restaurant&apos;s location below — geofencing has no effect until this is filled in.</p>
                  )}
                  <button onClick={useCurrentLocation} disabled={locating}
                    className="w-full py-2 bg-elevated hover:bg-elevated-hover disabled:opacity-50 text-foreground text-sm font-semibold rounded-lg">
                    {locating ? "Getting location…" : "📍 Use My Current Location"}
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Latitude</label>
                      <input type="number" step="0.000001" value={restaurantLat} onChange={(e) => setRestaurantLat(e.target.value)}
                        className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Longitude</label>
                      <input type="number" step="0.000001" value={restaurantLng} onChange={(e) => setRestaurantLng(e.target.value)}
                        className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Allowed Radius (metres)</label>
                    <input type="number" min="10" value={geofenceRadius} onChange={(e) => setGeofenceRadius(e.target.value)}
                      className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
                    <p className="mt-1 text-muted-foreground text-xs">150m is a reasonable default — GPS on a phone is typically accurate to 10-30m, tighter than that will cause false rejections.</p>
                  </div>
                  <p className="text-muted-foreground text-xs">A manager can always clock a team member in manually from Attendance → Team, bypassing this check (GPS trouble, dead phone, etc.). Browser location can be spoofed, so treat this as a soft deterrent, not a hard security control.</p>
                </div>
              )}
            </div>

            <button onClick={save} disabled={saving} className="w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-lg">
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save Settings"}
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <PermissionsPanel canEdit={canEditPermissions} />
          </div>
        )}
      </div>
      </div>
    </>
  );
}
