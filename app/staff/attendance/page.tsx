import { getSession } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";
import AttendanceView from "@/components/staff/AttendanceView";

export default async function AttendancePage() {
  const session = await getSession();
  return <AttendanceView isManager={session ? canManageStaff(session.role) : false} />;
}
