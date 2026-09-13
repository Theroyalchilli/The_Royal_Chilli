import type { Metadata, Viewport } from "next";
import { Poppins, Playfair_Display, Cinzel, Work_Sans, Space_Grotesk } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins" });

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-cinzel",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-worksans",
});

// Base font for the entire back office — Staff Hub, POS till and the staff
// login page (applied at each area's layout, see StaffShell.tsx and
// app/pos|login/layout.tsx) — set inline there rather than on <body> here so
// the public-facing website keeps its own Poppins/Playfair/Cinzel branding.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://royal-chilli-pos.vercel.app"),
  title: "The Royal Chilli - POS System",
  description: "Point of Sale system for The Royal Chilli, Hounslow",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#E34234",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} ${playfair.variable} ${cinzel.variable} ${workSans.variable} ${spaceGrotesk.variable} ${poppins.className} antialiased`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
