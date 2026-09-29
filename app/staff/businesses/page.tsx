import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import BusinessesView from "@/components/staff/BusinessesView";

const heading = { fontFamily: "var(--font-space-grotesk)" };

// The group owner's Businesses screen (owner only).
export default async function BusinessesPage() {
  const session = await getSession();
  if (!session?.owner) redirect("/staff");
  return (
    <div className="px-4 pb-12 pt-6 md:px-6">
      <div className="mx-auto max-w-[900px]">
        <h1 style={heading} className="text-[26px] font-semibold tracking-[-0.02em] text-foreground">Businesses</h1>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">Every business in the group. Each one runs on its own — only you can see across them.</p>
        <BusinessesView current={session.businessId} />
      </div>
    </div>
  );
}
