import { Queue } from "bullmq";
import IORedis from "ioredis";
import { publicationIdempotencyKey } from "./idempotency";
import { cancelIfPending } from "./cancellation";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null, enableReadyCheck: true });
export const publicationQueue = new Queue("publications", { connection, defaultJobOptions: { attempts: 1, removeOnComplete: { age: 7 * 86400 }, removeOnFail: { age: 30 * 86400 } } });
export const metricsQueue = new Queue("metrics", { connection, defaultJobOptions: { attempts: 1, removeOnComplete: { age: 7 * 86400 }, removeOnFail: { age: 30 * 86400 } } });

export async function enqueueAccountTask(input: { organizationId: string; batchId: string; accountId: string; publicationId: string; kind: "PUBLISH" | "METRICS"; scheduledAt?: Date }) {
  const queue = input.kind === "PUBLISH" ? publicationQueue : metricsQueue;
  const delay = input.scheduledAt ? Math.max(0, input.scheduledAt.getTime() - Date.now()) : 0;
  const name = input.kind === "PUBLISH" ? "publish-account" : "collect-account-metrics";
  return queue.add(name, input, {
    jobId: `${input.kind.toLowerCase()}-${publicationIdempotencyKey(input.organizationId, input.batchId, input.accountId)}`,
    delay,
    priority: input.kind === "PUBLISH" ? 1 : 10,
  });
}

export async function cancelPendingAccountJob(queue: Queue, jobId: string): Promise<boolean> {
  const job = await queue.getJob(jobId);
  return cancelIfPending(job);
}
