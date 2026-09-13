import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { robots: { index: false } };

export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return <div style={{ fontFamily: "var(--font-space-grotesk)" }}>{children}</div>;
}
