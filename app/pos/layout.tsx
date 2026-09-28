import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { TILL_COOKIE, verifyTillToken } from "@/lib/till-device";
import { Toaster } from "@/components/ui/toaster";
import NewOrderAlerts from "@/components/pos/NewOrderAlerts";
import IdleLogout from "@/components/pos/IdleLogout";

export const metadata: Metadata = { robots: { index: false } };

export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    // A paired till goes to the PIN pad; any other device to the password login.
    const till = await verifyTillToken((await cookies()).get(TILL_COOKIE)?.value);
    redirect(till ? "/pin" : "/login");
  }

  return (
    <div style={{ fontFamily: "var(--font-space-grotesk)" }}>
      {children}
      <NewOrderAlerts />
      <IdleLogout />
      <Toaster />
    </div>
  );
}
