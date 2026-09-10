import { getSession } from "@/lib/auth";
import { canManageDrivers } from "@/lib/permissions";
import DriversView from "@/components/staff/DriversView";

export default async function DriversPage() {
  const session = await getSession();
  return (
    <DriversView
      isManager={session ? canManageDrivers(session.role) : false}
      isDriver={(session?.role as string) === "driver"}
    />
  );
}
