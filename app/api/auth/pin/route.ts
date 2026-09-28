import { NextRequest, NextResponse } from "next/server";
import { createSession, getSessionCookieOptions, getSessionFromRequest } from "@/lib/auth";
import { clearPinFailures, findStaffByPin, pinLockedFor, recordPinFailure } from "@/lib/staff-pin";

// POST { pin } — switch the till to the staff member with this PIN. Only
// works on a till that's already signed in (a manager logs in each morning),
// so PINs can't be tried from outside. The new session is that person's own,
// with their own role: staff get the till and End of Day, managers also Staff Hub.
export async function POST(req: NextRequest) {
  const current = await getSessionFromRequest(req);
  if (!current) return NextResponse.json({ error: "The till isn't signed in — a manager needs to log in first." }, { status: 401 });

  // Throttle per signed-in till (the session in use), not per PIN.
  const key = req.cookies.get(getSessionCookieOptions().name)?.value.slice(-24) ?? String(current.id);
  const wait = pinLockedFor(key);
  if (wait > 0) return NextResponse.json({ error: `Too many wrong PINs — try again in ${wait}s.` }, { status: 429 });

  const { pin } = await req.json().catch(() => ({}));
  const staff = await findStaffByPin(String(pin ?? ""));
  if (!staff) {
    recordPinFailure(key);
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  clearPinFailures(key);

  const { name, options } = getSessionCookieOptions();
  const res = NextResponse.json({ user: staff });
  res.cookies.set(name, await createSession(staff), options);
  return res;
}
