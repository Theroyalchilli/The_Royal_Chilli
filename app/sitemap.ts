import type { MetadataRoute } from "next";

// NEXT_PUBLIC_SITE_URL should be set to the real production domain once one
// is chosen — falls back to the default Vercel URL so this still works before that.
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://royal-chilli-pos.vercel.app";

// Only the customer-facing, search-indexable pages. /order/checkout, /table/*,
// and everything under /pos, /staff, /login are transactional or private —
// deliberately excluded (and already noindexed where relevant).
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/menu", "/order", "/reservations", "/gallery", "/careers", "/reviews", "/about", "/catering", "/faq"];

  return staticRoutes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/menu" ? "daily" : "weekly",
    priority: route === "" ? 1 : route === "/menu" ? 0.9 : 0.6,
  }));
}
