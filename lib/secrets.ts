import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Payment keys entered on the Business setup page (Stripe, SumUp) are stored
// only as ciphertext (business_private.*_enc). The encryption key lives in the
// hosting settings (SETTINGS_ENCRYPTION_KEY: 32 random bytes, base64), never
// in the database, so a copy of the database alone can't reveal the keys.
// AES-256-GCM; stored as "v1:<iv>:<tag>:<ciphertext>" (base64 parts).

function key(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) throw new Error("SETTINGS_ENCRYPTION_KEY is not set");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("SETTINGS_ENCRYPTION_KEY must be 32 bytes (base64)");
  return k;
}

export function secretsConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [v, iv, tag, data] = stored.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
