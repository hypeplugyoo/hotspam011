import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { AccountLease, type LockStore } from "../lib/account-lock";
import { DemoInstagramAdapter, RealInstagramAdapter, type InstagramAdapter } from "./instagram-adapter";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
const adapter: InstagramAdapter = process.env.DEMO_MODE === "false" ? new RealInstagramAdapter() : new DemoInstagramAdapter();
const concurrency = Math.max(1, Number(process.env.PUBLISH_CONCURRENCY ?? 1));
const orgLimit = Math.max(1, Number(process.env.ORG_CONCURRENCY ?? 1));
const shutdown = new AbortController();

async function processJob(job: Job) {
  const { accountId, organizationId } = job.data as { accountId: string; organizationId: string };
  if (!accountId || !organizationId) throw new Error("Job sem organização ou conta vinculada.");
  const lockStore: LockStore = {
    set: async (key, value, expiryMs) => connection.set(key, value, "PX", expiryMs, "NX"),
    eval: async (script, numberOfKeys, ...args) => connection.eval(script, numberOfKeys, ...args),
  };
  const lease = await AccountLease.acquire(lockStore, accountId, String(job.id));
  if (!lease) { throw new Error("ACCOUNT_BUSY: já existe uma operação ativa nesta conta."); }
  const started = Date.now();
  const timer = setInterval(() => void lease.renew(), 20_000);
  try {
    // In production, an org-level semaphore and durable state transition must be acquired before browser startup.
    if (!Number.isFinite(orgLimit) || orgLimit < 1) throw new Error("Limite inválido.");
    const result = await adapter.run(job.name.includes("metrics") ? "COLLECT_METRICS" : "PUBLISH_IMAGE", job.data);
    if (result.outcome !== "CONFIRMED") throw new Error(result.reason ?? `Operação não confirmada (${result.outcome}).`);
    return { ...result, durationMs: Date.now() - started, mode: "DEMO" };
  } finally { clearInterval(timer); await lease.release(); }
}

const publications = new Worker("publications", processJob, { connection, concurrency, lockDuration: 90_000, stalledInterval: 30_000 });
const metrics = new Worker("metrics", processJob, { connection, concurrency: Math.max(1, Math.floor(concurrency / 2)), lockDuration: 90_000, stalledInterval: 30_000 });
for (const worker of [publications, metrics]) {
  worker.on("completed", job => console.log(JSON.stringify({ level: "info", event: "job_completed", jobId: job.id, durationMs: job.returnvalue?.durationMs, mode: "DEMO" })));
  worker.on("failed", (job, error) => console.error(JSON.stringify({ level: "error", event: "job_failed", jobId: job?.id, code: error.message.split(":")[0], mode: process.env.DEMO_MODE === "false" ? "DISABLED_REAL" : "DEMO" })));
}
async function close() { shutdown.abort(); await Promise.all([publications.close(), metrics.close()]); await connection.quit(); process.exit(0); }
process.once("SIGTERM", close); process.once("SIGINT", close);
console.log(JSON.stringify({ level: "info", event: "workers_started", publishConcurrency: concurrency, orgLimit, mode: process.env.DEMO_MODE === "false" ? "REAL_ADAPTER_DISABLED" : "DEMO" }));
