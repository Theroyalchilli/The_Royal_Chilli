import supabase from "@/lib/supabase";

// Which card reader the till drives (Staff → Settings). "none" = no reader:
// the till shows the manual "Card Paid" button for a standalone card machine.
export type TillCardProvider = "sumup" | "stripe" | "none";
export type TillReader = { provider: TillCardProvider; readerId: string };

export async function getTillReader(): Promise<TillReader> {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["till_card_provider", "sumup_reader_id", "stripe_terminal_reader_id"]);
  const s = Object.fromEntries((data ?? []).map((r) => [r.key, String(r.value ?? "").trim()]));

  // Before the provider setting existed, a Stripe reader id alone meant Stripe.
  const provider: TillCardProvider =
    s.till_card_provider === "sumup" || s.till_card_provider === "stripe" || s.till_card_provider === "none"
      ? s.till_card_provider
      : s.stripe_terminal_reader_id
        ? "stripe"
        : "none";

  const readerId = provider === "sumup" ? s.sumup_reader_id ?? "" : provider === "stripe" ? s.stripe_terminal_reader_id ?? "" : "";
  return { provider: readerId ? provider : "none", readerId };
}
