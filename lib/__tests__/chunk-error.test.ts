import { isStaleVersionError } from "@/lib/chunk-error";

describe("out-of-date page errors", () => {
  it("recognises missing-script errors from a new deploy", () => {
    expect(isStaleVersionError({ name: "ChunkLoadError", message: "Loading chunk 123 failed." })).toBe(true);
    expect(isStaleVersionError(new TypeError("Failed to fetch dynamically imported module: https://x/_next/a.js"))).toBe(true);
    expect(isStaleVersionError(new TypeError("Importing a module script failed."))).toBe(true);
  });
  it("leaves real bugs alone (they get the error screen)", () => {
    expect(isStaleVersionError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
    expect(isStaleVersionError(null)).toBe(false);
  });
});
