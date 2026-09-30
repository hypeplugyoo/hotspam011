import type { MetricSnapshot } from "./domain";

export type ViewDelta = { value: number | null; quality: "OBSERVED" | "PARTIAL" | "CORRECTION" | "UNAVAILABLE"; since: Date | null };

/** Computes positive counter movement in the selected local day. Corrections are surfaced, never counted as negative views. */
export function viewsGeneratedToday(snapshots: MetricSnapshot[], dayStartUtc: Date): ViewDelta {
  const valid = snapshots
    .filter(s => s.value !== null)
    .map(s => ({ ...s, time: new Date(s.observedAt) }))
    .filter(s => !Number.isNaN(s.time.getTime()))
    .sort((a, b) => a.time.getTime() - b.time.getTime());
  if (!valid.length) return { value: null, quality: "UNAVAILABLE", since: null };
  const first = valid.find(s => s.time >= dayStartUtc);
  const last = valid.at(-1)!;
  if (!first || last.time < dayStartUtc) return { value: null, quality: "UNAVAILABLE", since: null };
  const before = [...valid].reverse().find(s => s.time < dayStartUtc);
  if (!before) {
    if (first.quality === "BASELINE" && first.value === 0) {
      let total = 0;
      let previous = 0;
      for (const current of valid.filter(s => s.time >= first.time)) {
        if (current.value! < previous) return { value: null, quality: "CORRECTION", since: first.time };
        total += current.value! - previous;
        previous = current.value!;
      }
      return { value: total, quality: "OBSERVED", since: first.time };
    }
    return { value: last.value!, quality: "PARTIAL", since: first.time };
  }
  if (first.value! < before.value!) return { value: null, quality: "CORRECTION", since: before.time };
  let total = 0;
  let previous = before.value!;
  for (const current of valid.filter(s => s.time >= dayStartUtc)) {
    if (current.value! < previous) return { value: null, quality: "CORRECTION", since: before.time };
    total += current.value! - previous;
    previous = current.value!;
  }
  return { value: total, quality: "OBSERVED", since: before.time };
}

/** Reduces independent account/post counters only after each series has its own baseline. */
export function aggregateViewsGeneratedToday(snapshots: MetricSnapshot[], dayStartUtc: Date) {
  const series = new Map<string, MetricSnapshot[]>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.accountId}\u0000${snapshot.publicationId ?? "account"}\u0000${snapshot.metricName}\u0000${snapshot.definition}`;
    series.set(key, [...(series.get(key) ?? []), snapshot]);
  }
  const deltas = [...series.values()].map(rows => viewsGeneratedToday(rows, dayStartUtc));
  const observed = deltas.filter(delta => delta.value !== null);
  const total = observed.reduce((sum, delta) => sum + delta.value!, 0);
  const corrections = deltas.filter(delta => delta.quality === "CORRECTION").length;
  const unavailable = deltas.filter(delta => delta.quality === "UNAVAILABLE").length;
  const partial = deltas.some(delta => delta.quality === "PARTIAL");
  const quality = corrections > 0 ? "CORRECTION" : partial || unavailable > 0 ? "PARTIAL" : observed.length ? "OBSERVED" : "UNAVAILABLE";
  return { value: observed.length ? total : null, quality, observedSeries: observed.length, partialSeries: unavailable + (partial ? 1 : 0), correctedSeries: corrections };
}

export function completedPostCounts(rows: Array<{ kind: "IMAGE" | "CAROUSEL" | "REEL"; status: string }>) {
  const done = rows.filter(row => row.status === "PUBLISHED");
  const images = done.filter(row => row.kind === "IMAGE").length;
  const carousels = done.filter(row => row.kind === "CAROUSEL").length;
  const reels = done.filter(row => row.kind === "REEL").length;
  return { images, carousels, reels, total: images + carousels + reels, videos: reels };
}

export function orgScoped<T extends { organizationId: string }>(rows: T[], organizationId: string): T[] {
  return rows.filter(row => row.organizationId === organizationId);
}
