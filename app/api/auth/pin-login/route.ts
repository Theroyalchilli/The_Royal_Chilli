import { NextRequest, NextResponse } from "next/server";
import { createSession, getSessionCookieOptions } from "@/lib/auth";
import { clearPinFailures, findStaffByPin, pinLockedFor, recordPinFailure } from "@/lib/staff-pin";
import { tillFromRequest } from "@/lib/till-device";
import { staffBusinessIds } from "@/lib/business";

// POST { pin } — sign in at the till with a 4-digit PIN. Only on a paired
// till (lib/till-device.ts); anywhere else staff use username + password.
// The session is the PIN owner's own, with their own role.
export async function POST(req: NextRequest) {
  const till = await tillFromRequest(req);
  if (!till) {
    return NextResponse.json({ error: "This device isn't set up as a till — a manager needs to sign in with their password first." }, { status: 403 });
  }

  // Throttle per till device, not per PIN.
  const key = `till:${till.deviceId}`;
  const wait = pinLockedFor(key);
  if (wait > 0) return NextResponse.json({ error: `Too many wrong PINs — try again in ${wait}s.` }, { status: 429 });

  const { pin } = await req.json().catch(() => ({}));
  const staff = await findStaffByPin(String(pin ?? ""));
  if (!staff) {
    recordPinFailure(key);
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  // A PIN only works on the tills of businesses the person works at.
  if (!(await staffBusinessIds(staff.id)).includes(till.businessId)) {
    recordPinFailure(key);
    return NextResponse.json({ error: "You're not set up to work at this business." }, { status: 403 });
  }
  clearPinFailures(key);

  const user = { ...staff, businessId: till.businessId };
  const { name, options } = getSessionCookieOptions();
  const res = NextResponse.json({ user });
  res.cookies.set(name, await createSession(user), options);
  return res;
}
