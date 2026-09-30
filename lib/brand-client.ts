// Safe in the browser (no database imports) — shared by lib/brand.ts and the till.

export type Brand = {
  businessId: number;
  name: string;
  /** Short address for the receipt header. */
  address: string;
  /** Full address, e.g. for the Z report (split over lines to fit). */
  fullAddress: string;
  phone: string;
  /** Logo image, or null to show the business's initials instead. */
  logoUrl: string | null;
  tagline: string | null;
  /** Printed on receipts — only when the business is VAT registered. */
  vatNumber: string | null;
  /** Extra lines under the name / at the bottom of receipts (Business setup). */
  receiptHeader: string | null;
  receiptFooter: string | null;
};

/** Up to two initials, for a business with no logo yet ("Melt House" → "MH"). */
export function initials(name: string): string {
  return name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w) && w.toLowerCase() !== "the").slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}
