import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

const BASE_URL = SITE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/menu", "/order", "/reservations", "/gallery", "/careers", "/reviews", "/about", "/catering", "/faq"],
      // Internal/private areas and transactional flows should never be crawled
      // or show up in search results.
      disallow: ["/pos", "/staff", "/login", "/order/checkout", "/table", "/api"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
