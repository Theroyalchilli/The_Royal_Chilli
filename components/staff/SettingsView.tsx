"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PermissionKey = "manage_staff" | "manage_inventory" | "view_crm" | "manage_crm" | "manage_drivers" | "manage_finance";
type Matrix = Record<PermissionKey, Record<string, boolean>>;

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", admin: "Admin", manager: "Manager", supervisor: "Supervisor",
  cashier: "Cashier", waiter: "Waiter", chef: "Chef", kitchen: "Kitchen",
  driver: "Driver", inventory_manager: "Inventory Mgr", accountant: "Accountant", employee: "Employee",
};

function PermissionsPanel({ canEdit }: { canEdit: boolean }) {
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  function load() {
    fetch("/api/permissions").then((r) => r.json()).then((d) => {
      setMatrix(d.matrix);
      setRoles(d.roles || []);
      setPermissions(d.permissions || []);
      setLabels(d.labels || {});
    });
  }

  useEffect(() => { load(); }, []);

  async function toggle(role: string, permission: PermissionKey, current: boolean) {
    if (!canEdit || role === "owner") return;
    const cellKey = `${role}:${permission}`;
    setSaving(cellKey);
    setMatrix((m) => (m ? { ...m, [permission]: { ...m[permission], [role]: !current } } : m));
    const res = await fetch("/api/permissions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, permission, granted: !current }),
    });
    if (!res.ok) {
      // revert on failure (e.g. session expired mid-edit)
      setMatrix((m) => (m ? { ...m, [permission]: { ...m[permission], [role]: current } } : m));
    }
    setSaving(null);
  }

  if (!matrix) return <div className="text-muted-foreground text-sm py-6">Loading permissions…</div>;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-foreground font-bold text-lg">Roles &amp; Permissions</h2>
      <p className="mt-1 text-muted-foreground text-xs">
        Controls which roles can access each area of the system. Owner always has full access and cannot be changed here.
        {!canEdit && " Only Owner/Admin can edit this — you can view it read-only."}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left text-muted-foreground font-semibold p-2 sticky left-0 bg-surface">Permission</th>
              {roles.map((role) => (
                <th key={role} className="text-muted-foreground font-semibold p-2 text-center whitespace-nowrap">
                  {ROLE_LABELS[role] || role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((perm) => (
              <tr key={perm} className="border-t border-border">
                <td className="p-2 text-foreground sticky left-0 bg-surface max-w-[220px]">{labels[perm] || perm}</td>
                {roles.map((role) => {
                  const granted = matrix[perm]?.[role] ?? false;
                  const isOwner = role === "owner";
                  const cellKey = `${role}:${perm}`;
                  return (
                    <td key={role} className="p-2 text-center">
                      <button
                        disabled={!canEdit || isOwner || saving === cellKey}
                        onClick={() => toggle(role, perm, granted)}
                        className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                          granted ? "bg-red-600 border-red-500 text-white" : "bg-surface-hover border-border text-transparent"
                        } ${!canEdit || isOwner ? "opacity-60 cursor-not-allowed" : "hover:border-red-500 cursor-pointer"}`}
                        title={isOwner ? "Owner always has full access" : undefined}
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
  const [readerId, setReaderId] = useState("");
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

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: companyName, currency, week_start_day: weekStartDay, overtime_enabled: overtimeEnabled,
        vat_rate: Number(vatRate), max_employees: Number(maxEmployees),
        reservation_deposit_amount: Number(depositAmount),
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
            <h1 className="text-foreground font-bold text-2xl">Settings</h1>
            <div className="flex items-center gap-2">
              <Link href="/staff" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border">← Staff Hub</Link>
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
          <div className="mt-6 max-w-md rounded-2xl border border-border bg-surface p-5 space-y-4">
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
              <label className="block text-xs text-muted-foreground mb-1">Card Reader ID (Stripe Terminal)</label>
              <input type="text" placeholder="tmr_..." value={readerId} onChange={(e) => setReaderId(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm font-mono" />
              <p className="mt-1 text-muted-foreground text-xs">Leave blank to keep the manual &quot;Card Paid&quot; button (for a separate card machine). Paste the reader ID here once one is registered to enable real in-person card charges through the till.</p>
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
