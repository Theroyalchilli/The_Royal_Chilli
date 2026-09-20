import { getCustomerSession } from "@/lib/customer-auth";
import supabase from "@/lib/supabase";
import ProfileForm from "@/components/site/ProfileForm";

export default async function AccountProfilePage() {
  const session = await getCustomerSession();
  if (!session) return null; // layout already redirects

  const { data: customer } = await supabase
    .from("customers")
    .select("name, phone, email")
    .eq("id", session.id)
    .maybeSingle();

  const [firstName, ...rest] = (customer?.name || "").split(" ");

  return (
    <ProfileForm
      initialFirstName={firstName || ""}
      initialLastName={rest.join(" ")}
      initialPhone={customer?.phone || ""}
      email={customer?.email || session.email}
    />
  );
}
