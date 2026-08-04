import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewCrm } from "@/lib/permissions";

// Upcoming birthdays in the next 14 days (month/day match, year-agnostic).
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canViewCrm(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name, phone, date_of_birth")
    .not("date_of_birth", "is", null);
  if (error) return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });

  // Work entirely with UTC day-numbers (not Date-object local getters) so a
  // date_of_birth of "1990-07-26" is never off-by-one depending on server timezone.
  const now = new Date();
  const todayUtcDay = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000);
  const todayYear = now.getUTCFullYear();

  const upcoming = (customers || [])
    .map((c) => {
      const [, month, day] = (c.date_of_birth as string).split("-").map(Number);
      let nextBirthdayUtcDay = Math.floor(Date.UTC(todayYear, month - 1, day) / 86_400_000);
      if (nextBirthdayUtcDay < todayUtcDay) {
        nextBirthdayUtcDay = Math.floor(Date.UTC(todayYear + 1, month - 1, day) / 86_400_000);
      }
      return { ...c, days_away: nextBirthdayUtcDay - todayUtcDay };
    })
    .filter((c) => c.days_away <= 14)
    .sort((a, b) => a.days_away - b.days_away);

  return NextResponse.json({ upcomingBirthdays: upcoming });
}
