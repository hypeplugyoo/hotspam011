import { NextResponse } from "next/server";
import { requireIdentity } from "@/lib/auth";
import { db } from "@/lib/db";
import { aggregateViewsGeneratedToday } from "@/lib/metrics";
import type { MetricSnapshot, PublishStatus } from "@/lib/domain";

export const runtime = "nodejs";

type SnapshotRow = {
  accountId: string;
  publicationId: string | null;
  metricName: string;
  definition: string;
  value: string | number | null;
  observedAt: Date | string;
  source: "INSTAGRAM_UI";
  quality: MetricSnapshot["quality"];
};

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity();
    const requestedPeriod = new URL(request.url).searchParams.get("period");
    const period = requestedPeriod === "7d" ? "7d" : "today";

    const organizationResult = await db.query<{
      timezone: string;
      todayStart: Date;
      weekStart: Date;
    }>(
      `SELECT timezone,
        date_trunc('day', now() AT TIME ZONE timezone) AT TIME ZONE timezone AS "todayStart",
        (date_trunc('day', now() AT TIME ZONE timezone) - interval '6 days') AT TIME ZONE timezone AS "weekStart"
       FROM organizations WHERE id = $1`,
      [identity.organizationId],
    );
    const organization = organizationResult.rows[0];
    if (!organization) return NextResponse.json({ error: "Organização não encontrada." }, { status: 404 });
    const periodStart = period === "7d" ? organization.weekStart : organization.todayStart;

    const [summaryResult, formatsResult, recentResult, snapshotsResult, coverageResult] = await Promise.all([
      db.query(
        `SELECT
          (SELECT count(*)::int FROM instagram_accounts WHERE organization_id = $1) AS "accountCount",
          (SELECT count(*)::int FROM instagram_accounts WHERE organization_id = $1 AND state = 'CONNECTED') AS "connectedAccountCount",
          count(*) FILTER (WHERE p.status = 'PUBLISHED' AND p.published_at >= $2)::int AS "publishedCount",
          count(DISTINCT p.account_id) FILTER (WHERE p.status = 'PUBLISHED' AND p.published_at >= $2)::int AS "publishingAccountCount",
          count(*) FILTER (WHERE p.status IN ('FAILED','NEEDS_VERIFICATION','UNCERTAIN'))::int AS "attentionCount",
          count(*) FILTER (WHERE p.status = 'FAILED')::int AS "failedCount",
          count(*) FILTER (WHERE p.status = 'NEEDS_VERIFICATION')::int AS "verificationCount",
          count(*) FILTER (WHERE p.status = 'UNCERTAIN')::int AS "uncertainCount"
         FROM account_publications p WHERE p.organization_id = $1`,
        [identity.organizationId, periodStart],
      ),
      db.query(
        `SELECT kind, count(*)::int AS count FROM account_publications
         WHERE organization_id = $1 AND status = 'PUBLISHED' AND published_at >= $2
         GROUP BY kind`,
        [identity.organizationId, periodStart],
      ),
      db.query<{
        id: string; title: string; kind: MetricSnapshot["metricName"] extends never ? never : "IMAGE" | "CAROUSEL" | "REEL";
        username: string; createdAt: Date; publishedAt: Date | null; status: PublishStatus; views: string | number | null;
      }>(
        `SELECT p.id,
          COALESCE(NULLIF(m.original_name, ''), NULLIF(trim(p.caption), ''), 'Mídia sem título') AS title,
          p.kind, a.username, p.created_at AS "createdAt", p.published_at AS "publishedAt", p.status,
          (SELECT ms.metric_value FROM metric_snapshots ms
           WHERE ms.organization_id = p.organization_id AND ms.publication_id = p.id
             AND ms.source = 'INSTAGRAM_UI' AND lower(ms.metric_name) IN ('views','video_views','plays')
           ORDER BY ms.observed_at DESC LIMIT 1) AS views
         FROM account_publications p
         JOIN instagram_accounts a ON a.id = p.account_id AND a.organization_id = p.organization_id
         JOIN media m ON m.id = p.media_id AND m.organization_id = p.organization_id
         WHERE p.organization_id = $1 AND p.created_at >= $2
         ORDER BY p.created_at DESC LIMIT 20`,
        [identity.organizationId, periodStart],
      ),
      db.query<SnapshotRow>(
        `WITH recent_series AS (
           SELECT DISTINCT account_id, publication_id, metric_name, metric_definition
           FROM metric_snapshots
           WHERE organization_id = $1 AND source = 'INSTAGRAM_UI' AND observed_at >= $2
         ),
         selected AS (
           SELECT m.account_id AS "accountId", m.publication_id AS "publicationId",
             m.metric_name AS "metricName", m.metric_definition AS definition,
             m.metric_value AS value, m.observed_at AS "observedAt", m.source, m.quality
           FROM metric_snapshots m
           JOIN recent_series s USING (account_id, metric_name, metric_definition)
           WHERE m.organization_id = $1 AND m.source = 'INSTAGRAM_UI' AND m.observed_at >= $2
             AND m.publication_id IS NOT DISTINCT FROM s.publication_id
           UNION ALL
           SELECT prior.account_id AS "accountId", prior.publication_id AS "publicationId",
             prior.metric_name AS "metricName", prior.metric_definition AS definition,
             prior.metric_value AS value, prior.observed_at AS "observedAt", prior.source, prior.quality
           FROM recent_series s
           CROSS JOIN LATERAL (
             SELECT m.* FROM metric_snapshots m
             WHERE m.organization_id = $1 AND m.source = 'INSTAGRAM_UI'
               AND m.account_id = s.account_id AND m.publication_id IS NOT DISTINCT FROM s.publication_id
               AND m.metric_name = s.metric_name AND m.metric_definition = s.metric_definition
               AND m.observed_at < $2
             ORDER BY m.observed_at DESC LIMIT 1
           ) prior
         )
         SELECT * FROM selected ORDER BY "observedAt" ASC`,
        [identity.organizationId, periodStart],
      ),
      db.query(
        `SELECT count(DISTINCT account_id)::int AS "updatedAccountCount",
          max(observed_at) AS "lastObservedAt"
         FROM metric_snapshots WHERE organization_id = $1 AND source = 'INSTAGRAM_UI'
           AND observed_at >= now() - interval '24 hours'`,
        [identity.organizationId],
      ),
    ]);

    const snapshotRows = snapshotsResult.rows.map(row => ({
      ...row,
      value: row.value === null ? null : Number(row.value),
      observedAt: row.observedAt instanceof Date ? row.observedAt.toISOString() : new Date(row.observedAt).toISOString(),
    })) as MetricSnapshot[];
    const views = aggregateViewsGeneratedToday(snapshotRows, periodStart);
    const formats = { IMAGE: 0, CAROUSEL: 0, REEL: 0 };
    for (const row of formatsResult.rows as Array<{ kind: keyof typeof formats; count: number }>) {
      if (row.kind in formats) formats[row.kind] = Number(row.count);
    }
    const summary = summaryResult.rows[0];
    const coverage = coverageResult.rows[0];

    return NextResponse.json({
      period,
      timezone: organization.timezone,
      summary: {
        accountCount: Number(summary.accountCount),
        connectedAccountCount: Number(summary.connectedAccountCount),
        publishedCount: Number(summary.publishedCount),
        publishingAccountCount: Number(summary.publishingAccountCount),
        attentionCount: Number(summary.attentionCount),
        failedCount: Number(summary.failedCount),
        verificationCount: Number(summary.verificationCount),
        uncertainCount: Number(summary.uncertainCount),
        formats,
      },
      views: {
        ...views,
        lastObservedAt: coverage.lastObservedAt ? new Date(coverage.lastObservedAt).toISOString() : null,
        updatedAccountCount: Number(coverage.updatedAccountCount),
      },
      recentPosts: recentResult.rows.map(row => ({
        ...row,
        account: `@${row.username}`,
        views: row.views === null ? null : Number(row.views),
        createdAt: new Date(row.createdAt).toISOString(),
        publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
      })),
    });
  } catch (error) {
    if ((error as Error)?.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    console.error(JSON.stringify({ level: "error", event: "dashboard_load_failed" }));
    return NextResponse.json({ error: "Não foi possível carregar o painel." }, { status: 500 });
  }
}
