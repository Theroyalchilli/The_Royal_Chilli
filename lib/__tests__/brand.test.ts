// Branding comes from Business setup (businesses row) — nothing in code.
jest.mock("@/lib/business", () => ({
  __esModule: true,
  DEFAULT_BUSINESS_ID: 1,
  getBusiness: (id: number) => Promise.resolve(
    id === 1
      ? {
          id: 1, name: "The Royal Chilli", logo_url: "/logo.png", address: null, phone: "020 8797 3044", tagline: "Dil Se Desi",
          trading_address: { line1: "43 Kingsley Road", city: "Hounslow", county: "London", postcode: "TW3 1PA" },
          vat_registered: true, vat_number: "GB123456789", receipt_header: null, receipt_footer: "Thank you for dining with us.",
        }
      : id === 2
      ? { id: 2, name: "Melt House", logo_url: null, address: "45 Kingsley Rd, Hounslow TW3 1PA", phone: "+44 7777 138126", vat_registered: false, vat_number: "GB999" }
      : null,
  ),
}));

import { getBrand, initials } from "@/lib/brand";

describe("business branding", () => {
  it("reads The Royal Chilli's receipt header from its setup — same as it printed before", async () => {
    expect(await getBrand(1)).toMatchObject({
      name: "The Royal Chilli", address: "43 Kingsley Road, Hounslow TW3 1PA", fullAddress: "43 Kingsley Road, Hounslow, London, TW3 1PA",
      phone: "020 8797 3044", logoUrl: "/logo.png", tagline: "Dil Se Desi", receiptFooter: "Thank you for dining with us.",
      vatNumber: "GB123456789",
    });
  });

  it("another business never shows Royal Chilli's logo, tagline or address; no VAT number unless registered", async () => {
    const b = await getBrand(2);
    expect(b).toMatchObject({ name: "Melt House", address: "45 Kingsley Rd, Hounslow TW3 1PA", logoUrl: null, tagline: null, vatNumber: null });
    expect(JSON.stringify(b)).not.toMatch(/Royal Chilli|Dil Se Desi|43 Kingsley|8797/);
  });

  it("a business with nothing set up yet prints just blanks, never another's details", async () => {
    expect(await getBrand(9)).toMatchObject({ name: "", address: "", phone: "", logoUrl: null, receiptFooter: null });
  });

  it("initials stand in for a missing logo", () => {
    expect(initials("Melt House")).toBe("MH");
    expect(initials("The Royal Chilli")).toBe("RC");
    expect(initials("ABCD")).toBe("A");
  });
});
