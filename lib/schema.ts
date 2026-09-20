import { siteContent } from "@/lib/site-content";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function to24Hour(time12: string): string {
  const match = time12.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return time12;
  const [, h, m, meridiem] = match;
  let hour = parseInt(h, 10);
  if (meridiem.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (meridiem.toUpperCase() === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${m}`;
}

function toIntlPhone(localNumber: string): string {
  // UK-only formatter matching this one hardcoded landline — good enough
  // since there's a single contact number, not a general phone parser.
  return `+44 ${localNumber.trim().replace(/^0/, "")}`;
}

// schema.org Restaurant JSON-LD — built from the same siteContent used to
// render the page, so it can't drift from what's actually displayed.
// No aggregateRating: that needs real numbers from a live Google Places
// pull (see the reviews-are-hardcoded gap), and a fabricated rating is a
// Google Search Console penalty risk, not a quick win.
export function buildRestaurantSchema(siteUrl: string) {
  const { contact } = siteContent;
  const [openTime, closeTime] = contact.hours[0].time.split(/[–-]/).map((s) => s.trim());
  const days = contact.hours[0].day === "Every day" ? ALL_DAYS : [contact.hours[0].day];

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: "The Royal Chilli",
    image: `${siteUrl}/gallery/Royal_Mixed_Platter.webp`,
    url: siteUrl,
    telephone: toIntlPhone(contact.phone),
    address: {
      "@type": "PostalAddress",
      streetAddress: "43 Kingsley Road",
      addressLocality: "Hounslow",
      addressRegion: "London",
      postalCode: "TW3 1PA",
      addressCountry: "GB",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 51.4722309,
      longitude: -0.3580133,
    },
    servesCuisine: ["Indian", "South Indian", "North Indian", "Hyderabadi"],
    acceptsReservations: true,
    menu: `${siteUrl}/menu`,
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: days,
      opens: to24Hour(openTime),
      closes: to24Hour(closeTime),
    },
    sameAs: [contact.social.instagram],
  };
}
