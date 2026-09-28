// UK mobiles in one format — 07XXXXXXXXX — so the same number typed as
// "07700 900123", "07700-900123", "+44 7700 900123" or "447700900123" always
// finds the same customer. Safe to import in the browser.

/** The number as 07XXXXXXXXX, or null if it isn't a UK mobile. */
export function normalizeUkMobile(raw: string | null | undefined): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (/^447\d{9}$/.test(d)) d = `0${d.slice(2)}`;
  else if (/^7\d{9}$/.test(d)) d = `0${d}`;
  return /^07\d{9}$/.test(d) ? d : null;
}

/** For lookups: the clean mobile if it is one, else the trimmed input (older records). */
export function phoneKey(raw: string | null | undefined): string {
  return normalizeUkMobile(raw) ?? String(raw ?? "").trim();
}

/** "07700900123" → "07700 900123" for display. */
export function formatUkMobile(phone: string | null | undefined): string {
  const n = normalizeUkMobile(phone);
  return n ? `${n.slice(0, 5)} ${n.slice(5)}` : String(phone ?? "");
}
