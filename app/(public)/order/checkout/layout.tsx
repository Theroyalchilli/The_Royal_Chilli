import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout — The Royal Chilli",
  description: "Complete your order from The Royal Chilli.",
  robots: { index: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
