export type PublishStatus = "QUEUED" | "PROCESSING" | "PUBLISHED" | "FAILED" | "NEEDS_VERIFICATION" | "UNCERTAIN" | "CANCELLED";
export type MediaKind = "IMAGE" | "CAROUSEL" | "REEL";
export const statusLabel: Record<PublishStatus, string> = {
  QUEUED: "Na fila", PROCESSING: "Processando", PUBLISHED: "Publicado", FAILED: "Falhou",
  NEEDS_VERIFICATION: "Aguardando verificação", UNCERTAIN: "Resultado incerto", CANCELLED: "Cancelado",
};
export type Account = { id: string; username: string; title: string; group: string; state: "CONNECTED" | "ACTION_REQUIRED" | "DISCONNECTED"; initials: string; hue: string };
export type MetricSnapshot = { accountId: string; publicationId: string | null; metricName: string; definition: string; value: number | null; observedAt: string; source: "MOCK" | "INSTAGRAM_UI"; quality: "OBSERVED" | "BASELINE" | "CORRECTION" | "PARTIAL" };

// Deterministic sample data is labeled DEMO throughout the UI and must never be treated as Instagram data.
export const demoAccounts: Account[] = [
  { id: "a1", username: "studioaurora", title: "Studio Aurora", group: "Marca principal", state: "CONNECTED", initials: "SA", hue: "#9b78ff" },
  { id: "a2", username: "aurora.store", title: "Aurora Store", group: "Lojas", state: "CONNECTED", initials: "AS", hue: "#f4a261" },
  { id: "a3", username: "aurorabeauty", title: "Aurora Beauty", group: "Lojas", state: "ACTION_REQUIRED", initials: "AB", hue: "#e87da7" },
  { id: "a4", username: "aurora.fit", title: "Aurora Fit", group: "Creators", state: "CONNECTED", initials: "AF", hue: "#68b995" },
  { id: "a5", username: "aurora.casa", title: "Aurora Casa", group: "Creators", state: "CONNECTED", initials: "AC", hue: "#7ea4f3" },
];
export const demoPosts = [
  { id: "p1", title: "Coleção de primavera", kind: "REEL" as const, account: "@studioaurora", time: "Hoje, 15:42", status: "PUBLISHED" as const, views: 12540, delta: 824 },
  { id: "p2", title: "Novidades da semana", kind: "CAROUSEL" as const, account: "@aurora.store", time: "Hoje, 14:10", status: "PUBLISHED" as const, views: 4280, delta: 219 },
  { id: "p3", title: "Rotina de cuidados", kind: "IMAGE" as const, account: "@aurorabeauty", time: "Hoje, 13:35", status: "NEEDS_VERIFICATION" as const, views: null, delta: null },
  { id: "p4", title: "Look do dia", kind: "REEL" as const, account: "@aurora.fit", time: "Hoje, 11:20", status: "PUBLISHED" as const, views: 8900, delta: 436 },
  { id: "p5", title: "Casa com personalidade", kind: "IMAGE" as const, account: "@aurora.casa", time: "Hoje, 10:05", status: "FAILED" as const, views: null, delta: null },
];
