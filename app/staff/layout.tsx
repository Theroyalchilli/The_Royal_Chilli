import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { robots: { index: false } };

// Login is required for the whole Staff Hub; individual pages enforce their own
// role check (most need canManageStaff). Employee clock-in/out is no longer here
// — it lives in the dedicated attendance app's kiosk.
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
