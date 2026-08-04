import { getSession } from "@/lib/auth";
import { canManageStaff } from "@/lib/permissions";
import RotaView from "@/components/staff/RotaView";

export default async function RotaPage() {
  const session = await getSession();
  return <RotaView isManager={session ? canManageStaff(session.role) : false} />;
}
