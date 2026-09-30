import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type Sealed = { version: string; iv: string; tag: string; ciphertext: string };
function keyFromEnv(name: string): Buffer {
  const raw = process.env[name];
  if (!raw || raw.startsWith("REPLACE_")) throw new Error(`${name} must be configured with a random 32-byte base64 key.`);
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error(`${name} must decode to exactly 32 bytes.`);
  return key;
}
export function sealSecret(plaintext: string, keyName = "APP_ENCRYPTION_KEY", version = "v1"): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromEnv(keyName), iv);
  cipher.setAAD(Buffer.from(version));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { version, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}
export function openSecret(sealed: Sealed, keyName = "APP_ENCRYPTION_KEY"): string {
  const decipher = createDecipheriv("aes-256-gcm", keyFromEnv(keyName), Buffer.from(sealed.iv, "base64"));
  decipher.setAAD(Buffer.from(sealed.version));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
