// Delivery eligibility: a flat 5-mile radius from the restaurant (43 Kingsley
// Road, Hounslow, TW3 1PA), computed by geocoding postcodes via postcodes.io
// (a free, no-key-required UK postcode API) rather than a manually-curated
// list of postcode prefixes. Replaces the old zone-table approach — the
// delivery_zones table and its postcode_prefixes are no longer read.

const RESTAURANT_LAT = 51.471985;
const RESTAURANT_LNG = -0.355561;
const MAX_DELIVERY_MILES = 5;

export const DELIVERY_FEE = 3.5;
export const FREE_DELIVERY_THRESHOLD = 25;
export const MIN_DELIVERY_ORDER = 10;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Great-circle distance in miles (haversine formula) — accurate enough for a
// straight-line delivery-radius check; not driving distance.
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R_MILES = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodePostcode(postcode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.trim())}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 200 || !json.result) return null;
    return { lat: json.result.latitude, lng: json.result.longitude };
  } catch {
    return null;
  }
}

export type DeliveryEligibility = { deliverable: boolean; distanceMiles?: number };

export async function checkDeliveryEligibility(postcode: string): Promise<DeliveryEligibility> {
  const point = await geocodePostcode(postcode);
  if (!point) return { deliverable: false };
  const distanceMiles = haversineMiles(RESTAURANT_LAT, RESTAURANT_LNG, point.lat, point.lng);
  return { deliverable: distanceMiles <= MAX_DELIVERY_MILES, distanceMiles };
}

// £3.50 delivery fee, waived once the subtotal reaches £25.
export function computeDeliveryFee(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
}
