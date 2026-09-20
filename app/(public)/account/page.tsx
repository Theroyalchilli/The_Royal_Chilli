import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import LogoutButton from "@/components/site/LogoutButton";

// Phase 1 stub — just proves the auth round-trip end to end. Overview,
// Profile, Orders, Addresses, Loyalty, Scan & Pay, Bookings, Support and
// Unsubscribe land here in later phases.
export default async function AccountPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");

  return (
    <div className="mx-auto max-w-sm px-4 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-primary">My Account</p>
      <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl">
        Welcome, <span className="italic text-primary">{session.name}</span>
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{session.email}</p>
      <div className="mt-8">
        <LogoutButton />
      </div>
    </div>
  );
}
