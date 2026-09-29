import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import BusinessSetupView from "@/components/staff/BusinessSetupView";

const heading = { fontFamily: "var(--font-space-grotesk)" };

// Business setup for the business this login is working for (the owner can
// switch business in the header to set up another one).
export default async function BusinessSetupPage() {
  const session = await getSession();
  if (!session || !(session.owner || canAccess(session.role, "settings"))) redirect("/staff");
  return (
    <div className="px-4 pb-12 pt-6 md:px-6">
      <div className="mx-auto max-w-[900px]">
        <h1 style={heading} className="text-[26px] font-semibold tracking-[-0.02em] text-foreground">Business setup</h1>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          This business&apos;s details. The till, receipts, website and accountant export use what&apos;s entered here.
        </p>
        <BusinessSetupView />
      </div>
    </div>
  );
}
