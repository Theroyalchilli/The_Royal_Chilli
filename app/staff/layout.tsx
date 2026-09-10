import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { isStaffManagement } from "@/lib/permissions";

export const metadata: Metadata = { robots: { index: false } };

// Staff Hub is management-only (manager / hr / admin). Employees work from the
// POS; clock-in/out is the dedicated attendance app's kiosk. Individual pages
// still enforce their own per-tab check.
export default async function StaffHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) redirect("/login");
  if (!isStaffManagement(session.role)) redirect("/pos");

  return <>{children}</>;
}
