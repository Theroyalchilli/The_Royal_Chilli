import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Order — The Royal Chilli",
  description: "Review your order from The Royal Chilli.",
  robots: { index: false },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
