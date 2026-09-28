// Till PINs: lookup by PIN, and the wrong-PIN lock.
import bcrypt from "bcryptjs";

let staffRows: { id: number; name: string; role: string; pin_hash: string | null }[] = [];
jest.mock("@/lib/supabase", () => ({
  __esModule: true,
  default: { from: () => ({ select: () => ({ eq: () => ({ not: () => Promise.resolve({ data: staffRows }) }) }) }) },
}));

import { clearPinFailures, findStaffByPin, isManagerRole, pinLockedFor, recordPinFailure } from "@/lib/staff-pin";

describe("findStaffByPin", () => {
  beforeAll(async () => {
    staffRows = [
      { id: 1, name: "Royalchilli", role: "admin", pin_hash: await bcrypt.hash("1111", 4) },
      { id: 2, name: "Shweta", role: "employee", pin_hash: await bcrypt.hash("2222", 4) },
    ];
  });

  it("finds the person whose PIN it is, with their role", async () => {
    expect(await findStaffByPin("2222")).toEqual({ id: 2, name: "Shweta", role: "employee" });
    expect(isManagerRole((await findStaffByPin("1111"))!.role)).toBe(true);
  });

  it("rejects a wrong or malformed PIN, and can skip one person (uniqueness check)", async () => {
    expect(await findStaffByPin("9999")).toBeNull();
    expect(await findStaffByPin("12a4")).toBeNull();
    expect(await findStaffByPin("2222", 2)).toBeNull();
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
