import { Jost } from "next/font/google";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";

// Public-site-only body/nav font, styled after tamarindrestaurant.com's light,
// wide-tracked look. Their actual typeface (Domaine Sans) is a paid font
// licensed to them and hosted on their own domain, so this is the closest
// freely-licensed equivalent rather than a literal copy. Scoped to this
// layout only — POS, kitchen display, and staff hub keep the app's default
// font (Poppins, set in the root layout) for operational-screen legibility.
const jost = Jost({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-jost" });

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${jost.variable} flex min-h-screen flex-col font-[family-name:var(--font-jost)]`}>
      <SiteHeader />
      {/* Header is now fixed (out of flow) so the homepage hero can extend
          full-bleed behind it. Every page needs this padding to avoid its
          content starting underneath the header; the homepage cancels it
          with a matching negative margin on the hero section only. Single
          value at every breakpoint now — the header is one row everywhere
          since mobile nav moved into the hamburger overlay instead of a
          second row. */}
      <main className="flex-1 pt-[73px]">{children}</main>
      <SiteFooter />
    </div>
  );
}
