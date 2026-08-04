import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book a Table — The Royal Chilli",
  description: "Reserve a table at The Royal Chilli, Hounslow. Book online for date nights, family gatherings, and celebrations.",
};

export default function ReservationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
