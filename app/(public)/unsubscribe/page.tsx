import { unsubscribeKeyValid } from "@/lib/unsubscribe";
import UnsubscribeButton from "./UnsubscribeButton";

export const dynamic = "force-dynamic";

// Opened from "Unsubscribe" in a marketing email. A button (not an automatic
// change on page load) so email link-scanners can't unsubscribe people.
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ c?: string; k?: string }> }) {
  const { c = "", k = "" } = await searchParams;
  const valid = unsubscribeKeyValid(Number(c), k);
  return (
    <div className="mx-auto max-w-sm px-6 py-14 text-center">
      <div className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Email preferences</div>
      {valid ? (
        <>
          <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl">Stop offers emails?</h1>
          <p className="mt-3 text-muted-foreground">
            We&apos;ll stop sending you offers and rewards emails. You&apos;ll still get emails about your orders, bookings and vouchers.
          </p>
          <UnsubscribeButton c={c} k={k} />
        </>
      ) : (
        <>
          <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-3xl">Link not valid</h1>
          <p className="mt-3 text-muted-foreground">
            Please use the link from your most recent email, or turn off offers emails in your account settings.
          </p>
        </>
      )}
    </div>
  );
}
