// The public website address used in every link we send out — receipt QR
// codes, emails, Stripe return pages, sitemap. Always the live domain
// (theroyalchilli.com redirects to www). NEXT_PUBLIC_SITE_URL can point it
// elsewhere, but a leftover *.vercel.app value in Vercel's settings is
// ignored — customers should never be sent to the vercel.app address.
// Safe to import in the browser.
const LIVE = "https://www.theroyalchilli.com";
const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();

export const SITE_URL = (fromEnv && !/\.vercel\.app/i.test(fromEnv) ? fromEnv : LIVE).replace(/\/+$/, "");
