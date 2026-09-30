import { createHash } from "node:crypto";

/** Stable internal dedupe key. It does not guarantee exactly-once execution by Instagram. */
export function publicationIdempotencyKey(organizationId: string, batchId: string, accountId: string): string {
  return createHash("sha256").update(`${organizationId}:${batchId}:${accountId}`).digest("hex");
}
