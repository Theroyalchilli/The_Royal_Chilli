import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Login — The Royal Chilli",
  robots: { index: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "var(--font-space-grotesk)" }}>{children}</div>;
}
