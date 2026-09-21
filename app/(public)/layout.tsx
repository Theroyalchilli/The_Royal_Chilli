import { Jost } from "next/font/google";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import SplashScreen from "@/components/site/SplashScreen";
import CookieConsent from "@/components/site/CookieConsent";
import { buildRestaurantSchema } from "@/lib/schema";
import { getOpeningHours, summarizeOpeningHours } from "@/lib/opening-hours";

// Public-site-only body/nav font, styled after tamarindrestaurant.com's light,
// wide-tracked look. Their actual typeface (Domaine Sans) is a paid font
// licensed to them and hosted on their own domain, so this is the closest
// freely-licensed equivalent rather than a literal copy. Scoped to this
// layout only — POS, kitchen display, and staff hub keep the app's default
// font (Poppins, set in the root layout) for operational-screen legibility.
const jost = Jost({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-jost" });

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://royal-chilli-pos.vercel.app";
  const openingHours = await getOpeningHours();
  const schema = buildRestaurantSchema(siteUrl, openingHours);
  const hoursSummary = summarizeOpeningHours(openingHours);

  return (
    <div className={`${jost.variable} flex min-h-screen flex-col font-[family-name:var(--font-jost)]`}>
      {/* eslint-disable-next-line react/no-danger -- static JSON built server-side from siteContent, not user input */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <SplashScreen />
      <SiteHeader />
      {/* SiteHeader no longer renders a top bar — just the fixed hamburger
          button and its full-screen overlay — so there's no header height
          left to clear here. */}
      <main className="flex-1">{children}</main>
      <SiteFooter hours={hoursSummary} />
      <CookieConsent />
    </div>
  );
}
