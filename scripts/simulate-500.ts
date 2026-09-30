import { publicationIdempotencyKey } from "../src/lib/idempotency";
import { completedPostCounts } from "../src/lib/metrics";

// Queue/data-model load simulation only: this script does not open browsers or contact Instagram.
const started = performance.now();
const rows = Array.from({ length: 500 }, (_, index) => ({
  organizationId: "demo-organization",
  batchId: "demo-batch-500",
  accountId: `demo-account-${String(index + 1).padStart(3, "0")}`,
  kind: (["IMAGE", "CAROUSEL", "REEL"] as const)[index % 3],
}));
const keys = rows.map(row => publicationIdempotencyKey(row.organizationId, row.batchId, row.accountId));
const demoStatuses = rows.map((_, index) => ({ kind: rows[index].kind, status: index < 492 ? "PUBLISHED" : index < 496 ? "NEEDS_VERIFICATION" : "FAILED" }));
const counts = completedPostCounts(demoStatuses);
console.log(JSON.stringify({ mode: "SIMULATION_ONLY", note: "No browsers started. No Instagram accounts accessed. Not a throughput/capacity claim.", tasksCreated: rows.length, uniqueInternalKeys: new Set(keys).size, simulatedOutcomes: { published: counts.total, waiting: 4, failed: 4 }, elapsedMs: Math.round(performance.now() - started) }, null, 2));
