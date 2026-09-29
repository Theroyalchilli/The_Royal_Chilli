// Till PINs: lookup by PIN, and the wrong-PIN lock.
import bcrypt from "bcryptjs";

type Row = { id: number; name: string; role: string; pin_hash: string | null; business_id: number | null; is_owner: boolean };
let staffRows: Row[] = [];
// Applies the ".or(business_id.eq.X,is_owner.eq.true)" filter the real query uses.
jest.mock("@/lib/supabase", () => ({
  __esModule: true,
  default: {
    from: () => ({
      select: () => ({
        eq: () => ({
          not: () => ({
            or: (f: string) => {
              const bid = Number(/business_id\.eq\.(\d+)/.exec(f)?.[1]);
              return Promise.resolve({ data: staffRows.filter((r) => r.business_id === bid || r.is_owner) });
            },
          }),
        }),
      }),
    }),
  },
}));

import { clearPinFailures, findStaffByPin, isManagerRole, pinLockedFor, recordPinFailure } from "@/lib/staff-pin";

describe("findStaffByPin", () => {
  beforeAll(async () => {
    staffRows = [
      { id: 1, name: "Royalchilli", role: "admin", pin_hash: await bcrypt.hash("1111", 4), business_id: 1, is_owner: false },
      { id: 2, name: "Shweta", role: "employee", pin_hash: await bcrypt.hash("2222", 4), business_id: 1, is_owner: false },
      { id: 3, name: "Melt House cook", role: "employee", pin_hash: await bcrypt.hash("2222", 4), business_id: 2, is_owner: false },
      { id: 9, name: "Owner", role: "admin", pin_hash: await bcrypt.hash("9090", 4), business_id: null, is_owner: true },
    ];
  });

  it("finds the person whose PIN it is at this business, with their role", async () => {
    expect(await findStaffByPin("2222", 1)).toEqual({ id: 2, name: "Shweta", role: "employee", owner: false });
    expect(isManagerRole((await findStaffByPin("1111", 1))!.role)).toBe(true);
  });

  it("the same PIN at two businesses finds each business's own person", async () => {
    expect((await findStaffByPin("2222", 2))!.id).toBe(3);
    expect(await findStaffByPin("1111", 2)).toBeNull(); // Royal Chilli's admin isn't on Melt House's till
  });

  it("the owner can sign in on any business's till", async () => {
    expect(await findStaffByPin("9090", 1)).toMatchObject({ id: 9, owner: true });
    expect(await findStaffByPin("9090", 2)).toMatchObject({ id: 9, owner: true });
  });

  it("rejects a wrong or malformed PIN, and can skip one person (uniqueness check)", async () => {
    expect(await findStaffByPin("9999", 1)).toBeNull();
    expect(await findStaffByPin("12a4", 1)).toBeNull();
    expect(await findStaffByPin("2222", 1, 2)).toBeNull();
  });
});

describe("wrong-PIN lock", () => {
  it("locks for a minute after 5 wrong tries, and a right PIN clears it", () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) recordPinFailure("till", now);
    expect(pinLockedFor("till", now)).toBe(0);
    recordPinFailure("till", now);
    expect(pinLockedFor("till", now)).toBe(60);
    expect(pinLockedFor("till", now + 61_000)).toBe(0);
    recordPinFailure("till", now);
    clearPinFailures("till");
    expect(pinLockedFor("till", now)).toBe(0);
  });
});
