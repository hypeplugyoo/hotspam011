export type InstagramOperation = "AUTHENTICATE" | "CHECK_SESSION" | "PUBLISH_IMAGE" | "PUBLISH_CAROUSEL" | "PUBLISH_REEL" | "QUERY_RESULT" | "COLLECT_METRICS";
export type AdapterResult = { outcome: "CONFIRMED" | "NEEDS_HUMAN" | "UNCERTAIN" | "FAILED"; url?: string; reason?: string; metrics?: Array<{ name: string; definition: string; value: number }> };

/** Production adapter intentionally disabled until the authorized small-account flow is manually validated. */
export interface InstagramAdapter { run(operation: InstagramOperation, input: Record<string, unknown>): Promise<AdapterResult> }
export class DemoInstagramAdapter implements InstagramAdapter {
  async run(): Promise<AdapterResult> { return { outcome: "FAILED", reason: "DEMO_ONLY: nenhuma sessão real do Instagram está conectada." }; }
}
export class RealInstagramAdapter implements InstagramAdapter {
  async run(): Promise<AdapterResult> {
    throw new Error("Instagram UI adapter is not implemented. Do not mark this job published.");
  }
}
