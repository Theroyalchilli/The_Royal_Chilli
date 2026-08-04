import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { robots: { index: false } };

// Login is required for the whole Staff Hub, but not every page needs
// canManageStaff — Attendance/clock-in is for every employee, not just managers.
// Pages that need the stricter check (Employees, Payroll) enforce it themselves.
export default async function StaffHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}
