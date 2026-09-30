import { getBusiness } from "@/lib/business";
import { addressOneLine, type Address } from "@/lib/business-setup";
import type { Brand } from "@/lib/brand-client";

export type { Brand };
export { initials } from "@/lib/brand-client";

// What a business is called and how it shows up on staff screens and printed
// tickets — all from Settings → Business setup, nothing written in code. Each
// business is independent, so nothing of one business's (logo, tagline,
// address) ever appears on another's till or receipts.
export async function getBrand(businessId: number): Promise<Brand> {
  const b = await getBusiness(businessId);
  const trading = (b?.trading_address ?? null) as Address | null;
  return {
    businessId,
    name: b?.name ?? "",
    // Older rows only have the free-text address.
    address: addressOneLine(trading) || b?.address || "",
    fullAddress: addressFull(trading) || b?.address || "",
    phone: b?.phone ?? "",
    logoUrl: b?.logo_url || null,
    tagline: b?.tagline || null,
    vatNumber: b?.vat_registered && b.vat_number ? b.vat_number : null,
    receiptHeader: b?.receipt_header || null,
    receiptFooter: b?.receipt_footer || null,
  };
}

/** "43 Kingsley Road, Hounslow, London, TW3 1PA" — for the Z report header. */
function addressFull(a: Address | null): string {
  if (!a) return "";
  return [a.line1, a.line2, a.city, a.county, a.postcode].filter((p) => p && String(p).trim()).join(", ");
}
