// Extracts the outward code from a UK postcode ("TW3 1PA" -> "TW3"), which is
// how businesses practically define local delivery zones without geocoding.
export function outwardCode(postcode: string): string {
  const clean = postcode.trim().toUpperCase().replace(/\s+/g, " ");
  if (clean.includes(" ")) return clean.split(" ")[0];
  // No space typed — the inward code is always exactly 3 characters (digit + 2 letters).
  return clean.length > 3 ? clean.slice(0, -3) : clean;
}
