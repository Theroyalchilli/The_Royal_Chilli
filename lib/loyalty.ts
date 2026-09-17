import { randomBytes } from "crypto";
import supabase from "@/lib/supabase";

// Unambiguous alphabet — no 0/O, 1/I/L — so a code read aloud or handwritten
// isn't misheard/miscopied. Not sequential/guessable (doc §23): drawn from
// crypto.randomBytes, not Math.random().
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateRedemptionCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

export async function generateUniqueRedemptionCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRedemptionCode();
    const { data } = await supabase.from("loyalty_redemptions").select("id").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not generate a unique redemption code");
}
