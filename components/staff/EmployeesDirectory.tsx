"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Staff, StaffRole } from "@/lib/types";

const ROLES: { value: StaffRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "cashier", label: "Cashier" },
  { value: "waiter", label: "Waiter" },
  { value: "chef", label: "Chef" },
  { value: "kitchen", label: "Kitchen Staff" },
  { value: "driver", label: "Driver" },
  { value: "inventory_manager", label: "Inventory Manager" },
  { value: "accountant", label: "Accountant" },
  { value: "employee", label: "Employee" },
];

type FormState = {
  name: string;
  username: string;
  password: string;
  role: StaffRole;
  email: string;
  phone: string;
  employment_type: "hourly" | "salaried";
  pay_rate: string;
  pay_frequency: "weekly" | "monthly";
  hire_date: string;
};

function EmployeeModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Staff;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    name: editing.name, username: editing.username || "", password: "", role: editing.role,
    email: editing.email || "", phone: editing.phone || "",
    employment_type: editing.employment_type, pay_rate: String(editing.pay_rate),
    pay_frequency: editing.pay_frequency, hire_date: editing.hire_date || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!form.name.trim() || !form.username.trim()) {
      setError("Name and username are required.");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        role: form.role,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        employment_type: form.employment_type,
        pay_rate: Number(form.pay_rate) || 0,
        pay_frequency: form.pay_frequency,
        hire_date: form.hire_date || null,
      };
      if (form.password) payload.password = form.password;

      const res = await fetch(`/api/employees/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-foreground font-bold text-lg">Edit {editing.name}</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="col-span-2 bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            <input placeholder="Username" value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            <input placeholder="New password (leave blank to keep)" type="password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
              className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
              className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
            <select value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value as "hourly" | "salaried" })}
              className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
              <option value="hourly">Hourly</option>
              <option value="salaried">Salaried</option>
            </select>
            <select value={form.pay_frequency} onChange={(e) => setForm({ ...form, pay_frequency: e.target.value as "weekly" | "monthly" })}
              className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-muted-foreground text-sm">£</span>
              <input type="number" step="0.01" placeholder="Pay rate"
                value={form.pay_rate} onChange={(e) => setForm({ ...form, pay_rate: e.target.value })}
                className="flex-1 bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm" />
              <span className="text-muted-foreground text-xs">{form.employment_type === "hourly" ? "per hour" : `per ${form.pay_frequency === "weekly" ? "week" : "month"}`}</span>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 bg-elevated hover:bg-elevated-hover text-foreground font-semibold rounded-xl">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 h-11 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmployeesDirectory() {
  const [employees, setEmployees] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("1");
  const [modalFor, setModalFor] = useState<Staff | null>(null);

  const fetchEmployees = useCallback(async () => {
    const params = new URLSearchParams({ active: activeFilter });
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);
    const res = await fetch(`/api/employees?${params}`);
    const data = await res.json();
    setEmployees(data.employees || []);
    setLoading(false);
  }, [search, roleFilter, activeFilter]);

  useEffect(() => {
    setLoading(true);
    fetchEmployees();
  }, [fetchEmployees]);

  async function toggleActive(emp: Staff) {
    await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: emp.active ? 0 : 1 }),
    });
    fetchEmployees();
  }

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-foreground font-bold text-2xl">Employees</h1>
            <p className="text-muted-foreground text-sm">{employees.length} shown</p>
          </div>
          <div className="flex gap-2">
            <Link href="/staff" className="px-4 py-2 bg-surface-hover hover:bg-elevated text-foreground text-sm font-semibold rounded-lg border border-border">
              ← Staff Hub
            </Link>
            <Link href="/staff/hr" className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg">
              + Add Employee (via HR)
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mt-5 flex flex-wrap gap-3">
          <input placeholder="Search name, ID, email…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm flex-1 min-w-[200px]" />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}
            className="bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground text-sm">
            <option value="1">Active</option>
            <option value="0">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="mt-5 rounded-xl border border-border overflow-x-auto">
          {loading ? (
            <div className="text-muted-foreground text-center py-16">Loading…</div>
          ) : employees.length === 0 ? (
            <div className="text-muted-foreground text-center py-16">No employees match.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Contact</th>
                  <th className="text-left px-4 py-3">Pay</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employees.map((emp) => (
                  <tr key={emp.id} className="bg-background hover:bg-surface">
                    <td className="px-4 py-3 text-muted-foreground">{emp.employee_number}</td>
                    <td className="px-4 py-3 text-foreground font-medium">{emp.name}</td>
                    <td className="px-4 py-3 text-foreground capitalize">{emp.role.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{emp.phone || emp.email || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">£{Number(emp.pay_rate).toFixed(2)} {emp.employment_type === "hourly" ? "/hr" : `/${emp.pay_frequency === "weekly" ? "wk" : "mo"}`}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${emp.active ? "bg-green-100 text-green-700" : "bg-surface-hover text-muted-foreground"}`}>
                        {emp.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => setModalFor(emp)} className="text-red-600 hover:text-red-700 text-xs font-semibold">Edit</button>
                      <button onClick={() => toggleActive(emp)} className="text-muted-foreground hover:text-foreground text-xs font-semibold">
                        {emp.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalFor && (
        <EmployeeModal
          editing={modalFor}
          onClose={() => setModalFor(null)}
          onSaved={fetchEmployees}
        />
      )}
      </div>
    </>
  );
}
