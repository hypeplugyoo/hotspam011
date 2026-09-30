import { describe, expect, it } from "vitest";
import { viewsGeneratedToday, aggregateViewsGeneratedToday, completedPostCounts, orgScoped } from "../src/lib/metrics";
import { publicationIdempotencyKey } from "../src/lib/idempotency";
import { AccountLease, type LockStore } from "../src/lib/account-lock";
import { sealSecret, openSecret } from "../src/lib/crypto";
import { cancelIfPending } from "../src/lib/cancellation";
import { recoveryDecision } from "../src/lib/recovery";

describe("tenant scope", () => {
  it("returns records only for the requested organization", () => {
    expect(orgScoped([{ organizationId: "org-a", id: 1 }, { organizationId: "org-b", id: 2 }], "org-a")).toEqual([{ organizationId: "org-a", id: 1 }]);
  });
});
describe("publication counters", () => {
  it("counts only completed, exclusive categories; a reel is one video and one post", () => {
    expect(completedPostCounts([{ kind: "REEL", status: "PUBLISHED" }, { kind: "REEL", status: "FAILED" }, { kind: "IMAGE", status: "PUBLISHED" }, { kind: "CAROUSEL", status: "PUBLISHED" }])).toEqual({ images: 1, carousels: 1, reels: 1, total: 3, videos: 1 });
  });
});
describe("view snapshots", () => {
  const start = new Date("2026-09-29T03:00:00.000Z");
  it("reports partial when the start-of-day baseline is missing", () => {
    expect(viewsGeneratedToday([{ accountId: "a", publicationId: "p", metricName: "views", definition: "views", value: 20, observedAt: "2026-09-29T12:00:00Z", source: "MOCK", quality: "OBSERVED" }], start)).toMatchObject({ value: 20, quality: "PARTIAL" });
  });
  it("detects downward counter corrections instead of adding them", () => {
    const result = viewsGeneratedToday([
      { accountId: "a", publicationId: "p", metricName: "views", definition: "views", value: 100, observedAt: "2026-09-29T02:00:00Z", source: "MOCK", quality: "OBSERVED" },
      { accountId: "a", publicationId: "p", metricName: "views", definition: "views", value: 110, observedAt: "2026-09-29T10:00:00Z", source: "MOCK", quality: "OBSERVED" },
      { accountId: "a", publicationId: "p", metricName: "views", definition: "views", value: 90, observedAt: "2026-09-29T11:00:00Z", source: "MOCK", quality: "OBSERVED" },
    ], start);
    expect(result.quality).toBe("CORRECTION"); expect(result.value).toBeNull();
  });
  it("keeps each post's baseline separate and sums today's observed gains", () => {
    const snapshots = [
      { accountId: "a", publicationId: "old", metricName: "views", definition: "views", value: 100, observedAt: "2026-09-29T02:00:00Z", source: "MOCK" as const, quality: "OBSERVED" as const },
      { accountId: "a", publicationId: "old", metricName: "views", definition: "views", value: 130, observedAt: "2026-09-29T12:00:00Z", source: "MOCK" as const, quality: "OBSERVED" as const },
      { accountId: "a", publicationId: "new", metricName: "views", definition: "views", value: 0, observedAt: "2026-09-29T11:00:00Z", source: "MOCK" as const, quality: "BASELINE" as const },
      { accountId: "a", publicationId: "new", metricName: "views", definition: "views", value: 12, observedAt: "2026-09-29T12:00:00Z", source: "MOCK" as const, quality: "OBSERVED" as const },
    ];
    expect(aggregateViewsGeneratedToday(snapshots, start)).toMatchObject({ value: 42, quality: "OBSERVED", observedSeries: 2 });
  });
});
describe("idempotency and account lock", () => {
  it("generates a stable key per org, batch, and account", () => {
    const a = publicationIdempotencyKey("o", "b", "a");
    expect(a).toBe(publicationIdempotencyKey("o", "b", "a"));
    expect(a).not.toBe(publicationIdempotencyKey("o", "b", "other"));
  });
  it("only releases or renews a lease owned by its token", async () => {
    const values = new Map<string,string>();
    const redis: LockStore = {
      async set(key, value) { if (values.has(key)) return null; values.set(key, value); return "OK"; },
      async eval(script, _n, key, token) { if (values.get(key) !== token) return 0; if (script.includes("del")) values.delete(key); return 1; },
    };
    const lease = await AccountLease.acquire(redis, "account", "worker-1");
    expect(lease).toBeTruthy();
    expect(await AccountLease.acquire(redis, "account", "worker-2")).toBeNull();
    expect(await lease!.renew()).toBe(true);
    await lease!.release();
    expect(await AccountLease.acquire(redis, "account", "worker-2")).toBeTruthy();
  });
});
describe("job cancellation and worker recovery", () => {
  it("cancels queued jobs and leaves active work untouched", async () => {
    let removed = false;
    expect(await cancelIfPending({ getState: async () => "waiting", remove: async () => { removed = true; } })).toBe(true);
    expect(removed).toBe(true);
    expect(await cancelIfPending({ getState: async () => "active", remove: async () => { throw new Error("must not remove active"); } })).toBe(false);
  });
  it("does not blindly retry an operation whose submit may have reached Instagram", () => {
    expect(recoveryDecision("NETWORK_TIMEOUT", true)).toBe("MARK_UNCERTAIN");
    expect(recoveryDecision("BROWSER_CRASH_BEFORE_SUBMIT", false)).toBe("RETRY_TRANSIENT");
    expect(recoveryDecision("TWO_FACTOR", false)).toBe("WAIT_FOR_HUMAN");
  });
  it("can model 500 independent account jobs without starting browser processes", () => {
    const accounts = Array.from({ length: 500 }, (_, i) => `account-${i + 1}`);
    const jobs = accounts.map(accountId => ({ organizationId: "org-demo", batchId: "batch-demo", accountId }));
    expect(jobs).toHaveLength(500);
    expect(new Set(jobs.map(j => publicationIdempotencyKey(j.organizationId, j.batchId, j.accountId))).size).toBe(500);
  });
});
describe("secret encryption", () => {
  it("round-trips and detects modified ciphertext", () => {
    const original = process.env.APP_ENCRYPTION_KEY;
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    try {
      const sealed = sealSecret("test password");
      expect(openSecret(sealed)).toBe("test password");
      expect(() => openSecret({ ...sealed, ciphertext: Buffer.alloc(16).toString("base64") })).toThrow();
    } finally { if (original === undefined) delete process.env.APP_ENCRYPTION_KEY; else process.env.APP_ENCRYPTION_KEY = original; }
  });
});
