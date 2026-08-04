import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://royal-chilli-pos.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/menu", "/order", "/reservations", "/gallery", "/careers", "/reviews"],
      // Internal/private areas and transactional flows should never be crawled
      // or show up in search results.
      disallow: ["/pos", "/staff", "/login", "/order/checkout", "/table", "/api"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
