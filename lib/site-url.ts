// The public website address used in every link we send out — receipt QR
// codes, emails, Stripe return pages, sitemap. Set NEXT_PUBLIC_SITE_URL in
// Vercel to override; otherwise it's the live domain (theroyalchilli.com
// redirects to www). Safe to import in the browser.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.theroyalchilli.com").replace(/\/+$/, "");
