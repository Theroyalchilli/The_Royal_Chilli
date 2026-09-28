// One customer, one record: phone formats and the mobile-OR-email match.
type Row = { id: number; name: string; phone: string | null; email: string | null; loyalty_points: number; password_hash: string | null; merged_into?: number | null };
let rows: Row[] = [];

jest.mock("@/lib/supabase", () => {
  const query = () => {
    const filters: ((r: Row) => boolean)[] = [];
    const q = {
      select: () => q,
      eq: (col: keyof Row, v: unknown) => (filters.push((r) => r[col] === v), q),
      is: (col: keyof Row, v: unknown) => (filters.push((r) => (r[col] ?? null) === v), q),
      ilike: (col: keyof Row, v: string) => (filters.push((r) => String(r[col] ?? "").toLowerCase() === v.split(String.fromCharCode(92)).join("").toLowerCase()), q),
      limit: () => q,
      order: () => q,
      maybeSingle: async () => ({ data: rows.filter((r) => filters.every((f) => f(r)))[0] ?? null }),
      then: (res: (v: { data: Row[] }) => unknown) => res({ data: rows.filter((r) => filters.every((f) => f(r))) }),
    };
    return q;
  };
  return { __esModule: true, default: { from: () => query() } };
});

import { normalizeUkMobile, formatUkMobile } from "@/lib/phone";
import { findMember } from "@/lib/customer-match";

describe("UK mobiles in one format", () => {
  it("spaces, dashes, +44 and 44 all become 07…", () => {
    for (const v of ["07700 900123", "07700-900-123", "+44 7700 900123", "447700900123", "7700900123"]) {
      expect(normalizeUkMobile(v)).toBe("07700900123");
    }
  });
  it("anything that isn't a UK mobile is refused", () => {
    for (const v of ["", "020 8797 3044", "0770090012", "+1 415 555 0100", "hello"]) expect(normalizeUkMobile(v)).toBeNull();
  });
  it("displays nicely", () => {
    expect(formatUkMobile("07700900123")).toBe("07700 900123");
  });
});

describe("match on mobile OR email", () => {
  const priya: Row = { id: 1, name: "Priya", phone: "07700111222", email: "priya@mail.com", loyalty_points: 960, password_hash: "x" };
  const ravi: Row = { id: 2, name: "Ravi", phone: "07700333444", email: null, loyalty_points: 100, password_hash: null };
  const emailOnly: Row = { id: 3, name: "Sam", phone: null, email: "sam@mail.com", loyalty_points: 500, password_hash: "x" };
  const guestPhone: Row = { id: 4, name: "Sam", phone: "07700555666", email: null, loyalty_points: 0, password_hash: null };
  beforeEach(() => { rows = [priya, ravi, emailOnly, guestPhone]; });

  it("nothing matches → none", async () => {
    expect((await findMember("07700999999", "new@mail.com")).kind).toBe("none");
  });
  it("mobile typed differently still finds them", async () => {
    const m = await findMember("+44 7700 111 222", null);
    expect(m).toMatchObject({ kind: "match", by: "phone", member: { id: 1 } });
  });
  it("a new number with a known email → the same person, by email", async () => {
    const m = await findMember("07700999999", "PRIYA@mail.com");
    expect(m).toMatchObject({ kind: "match", by: "email", member: { id: 1 } });
  });
  it("mobile and email on two different people → conflict, not mergeable", async () => {
    const m = await findMember("07700333444", "priya@mail.com");
    expect(m).toMatchObject({ kind: "conflict", phoneMember: { id: 2 }, emailMember: { id: 1 }, mergeable: false });
  });
  it("phone-only guest + email-only account → conflict that's safe to merge", async () => {
    const m = await findMember("07700555666", "sam@mail.com");
    expect(m).toMatchObject({ kind: "conflict", mergeable: true, phoneMember: { id: 4 }, emailMember: { id: 3 } });
  });
  it("merged records are ignored", async () => {
    rows = [{ ...ravi, merged_into: 1 }];
    expect((await findMember("07700333444", null)).kind).toBe("none");
  });
});
