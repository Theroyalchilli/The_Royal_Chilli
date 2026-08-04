import supabase from "@/lib/supabase";
import { outwardCode } from "@/lib/postcode";

export type MatchedZone = { id: number; name: string; fee: number; min_order: number };

// Longest-prefix-wins: a zone scoped to "TW3" beats a broader catch-all "TW" zone
// covering the same postcode, regardless of table order.
export async function matchDeliveryZone(postcode: string): Promise<MatchedZone | null> {
  const code = outwardCode(postcode);
  if (!code) return null;

  const { data: zones } = await supabase.from("delivery_zones").select("*").eq("active", 1);
  let best: MatchedZone | null = null;
  let bestLen = -1;
  for (const z of zones || []) {
    for (const prefix of z.postcode_prefixes as string[]) {
      const p = prefix.trim().toUpperCase();
      if (code.startsWith(p) && p.length > bestLen) {
        best = { id: z.id, name: z.name, fee: Number(z.fee), min_order: Number(z.min_order) };
        bestLen = p.length;
      }
    }
  }
  return best;
}
