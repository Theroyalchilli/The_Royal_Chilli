import type { Metadata } from "next";

// Deliberately outside /pos: that layout redirects to /login once a staff
// session expires (12h), and the Print Station runs unattended all day on its
// own paired key (lib/print-station.ts).
export const metadata: Metadata = { title: "Print Station", robots: { index: false } };

export default function PrintStationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
