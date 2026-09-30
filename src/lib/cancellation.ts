export async function cancelIfPending(job: { getState(): Promise<string>; remove(): Promise<void> } | null | undefined): Promise<boolean> {
  if (!job) return false;
  const state = await job.getState();
  if (!new Set(["waiting", "delayed", "prioritized"]).has(state)) return false;
  await job.remove();
  return true;
}
