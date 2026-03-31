import { db } from '@/db';
import * as schema from '@/db/schema';
import { sql, gte, eq, and, desc, inArray } from 'drizzle-orm';

// ── Simulation Quality ──────────────────────────────────────────────────────

export type CategoryDistribution = {
  category: string;
  count: number;
  avgPercentage: number;
};

export type AgeBucket = {
  label: string;
  count: number;
};

export type DonationVelocityPoint = {
  hour: string;
  count: number;
};

export type MessagePoolHealth = {
  campaignId: string;
  campaignTitle: string;
  total: number;
  unused: number;
  used: number;
};

export type DonorNameRepetition = {
  donorName: string;
  occurrences: number;
  campaigns: number;
};

export type SimulationQuality = {
  categoryDistribution: CategoryDistribution[];
  ageBuckets: AgeBucket[];
  donationVelocity: DonationVelocityPoint[];
  messagePoolHealth: MessagePoolHealth[];
  donorNameRepetitions: DonorNameRepetition[];
};

export async function getSimulationQuality(): Promise<SimulationQuality> {
  const [categoryDistribution, ageBuckets, donationVelocity, messagePoolHealth, donorNameRepetitions] =
    await Promise.all([
      getCategoryDistribution(),
      getAgeBuckets(),
      getDonationVelocity(),
      getMessagePoolHealth(),
      getDonorNameRepetitions(),
    ]);

  return { categoryDistribution, ageBuckets, donationVelocity, messagePoolHealth, donorNameRepetitions };
}

async function getCategoryDistribution(): Promise<CategoryDistribution[]> {
  const rows = await db
    .select({
      category: schema.campaigns.category,
      count: sql<number>`count(*)::int`,
      avgPercentage: sql<number>`round(avg(
        CASE WHEN ${schema.campaigns.goalAmount} > 0
        THEN (${schema.campaigns.raisedAmount}::float / ${schema.campaigns.goalAmount}) * 100
        ELSE 0 END
      ))::int`,
    })
    .from(schema.campaigns)
    .where(inArray(schema.campaigns.status, ['active', 'last_donor_zone']))
    .groupBy(schema.campaigns.category)
    .orderBy(sql`count(*) desc`);

  return rows.map((r) => ({
    category: String(r.category),
    count: r.count,
    avgPercentage: r.avgPercentage,
  }));
}

async function getAgeBuckets(): Promise<AgeBucket[]> {
  const rows = await db
    .select({
      bucket: sql<string>`CASE
        WHEN ${schema.campaigns.publishedAt} >= NOW() - INTERVAL '7 days' THEN '<7d'
        WHEN ${schema.campaigns.publishedAt} >= NOW() - INTERVAL '30 days' THEN '7-30d'
        WHEN ${schema.campaigns.publishedAt} >= NOW() - INTERVAL '60 days' THEN '30-60d'
        ELSE '>60d'
      END`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.campaigns)
    .where(inArray(schema.campaigns.status, ['active', 'last_donor_zone']))
    .groupBy(sql`CASE
      WHEN ${schema.campaigns.publishedAt} >= NOW() - INTERVAL '7 days' THEN '<7d'
      WHEN ${schema.campaigns.publishedAt} >= NOW() - INTERVAL '30 days' THEN '7-30d'
      WHEN ${schema.campaigns.publishedAt} >= NOW() - INTERVAL '60 days' THEN '30-60d'
      ELSE '>60d'
    END`);

  const order = ['<7d', '7-30d', '30-60d', '>60d'];
  const bucketMap = new Map(rows.map((r) => [r.bucket, r.count]));
  return order.map((label) => ({ label, count: bucketMap.get(label) ?? 0 }));
}

async function getDonationVelocity(): Promise<DonationVelocityPoint[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      hour: sql<string>`to_char(date_trunc('hour', ${schema.donations.createdAt}), 'YYYY-MM-DD HH24:00')`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.donations)
    .where(gte(schema.donations.createdAt, sevenDaysAgo))
    .groupBy(sql`date_trunc('hour', ${schema.donations.createdAt})`)
    .orderBy(sql`date_trunc('hour', ${schema.donations.createdAt})`);

  return rows.map((r) => ({
    hour: String(r.hour),
    count: r.count,
  }));
}

async function getMessagePoolHealth(): Promise<MessagePoolHealth[]> {
  const rows = await db
    .select({
      campaignId: schema.campaignSeedMessages.campaignId,
      campaignTitle: schema.campaigns.title,
      total: sql<number>`count(*)::int`,
      unused: sql<number>`count(*) filter (where ${schema.campaignSeedMessages.used} = false)::int`,
      used: sql<number>`count(*) filter (where ${schema.campaignSeedMessages.used} = true)::int`,
    })
    .from(schema.campaignSeedMessages)
    .innerJoin(schema.campaigns, eq(schema.campaignSeedMessages.campaignId, schema.campaigns.id))
    .where(inArray(schema.campaigns.status, ['active', 'last_donor_zone']))
    .groupBy(schema.campaignSeedMessages.campaignId, schema.campaigns.title)
    .orderBy(sql`count(*) filter (where ${schema.campaignSeedMessages.used} = false) asc`);

  return rows.map((r) => ({
    campaignId: r.campaignId,
    campaignTitle: r.campaignTitle,
    total: r.total,
    unused: r.unused,
    used: r.used,
  }));
}

async function getDonorNameRepetitions(): Promise<DonorNameRepetition[]> {
  const rows = await db
    .select({
      donorName: schema.donations.donorName,
      occurrences: sql<number>`count(*)::int`,
      campaigns: sql<number>`count(distinct ${schema.donations.campaignId})::int`,
    })
    .from(schema.donations)
    .where(
      and(
        eq(schema.donations.source, 'seed'),
        eq(schema.donations.isAnonymous, false),
      ),
    )
    .groupBy(schema.donations.donorName)
    .having(sql`count(*) >= 5`)
    .orderBy(sql`count(*) desc`)
    .limit(50);

  return rows.map((r) => ({
    donorName: r.donorName,
    occurrences: r.occurrences,
    campaigns: r.campaigns,
  }));
}

// ── Pipeline Health ─────────────────────────────────────────────────────────

export type SourceStatus = {
  source: string;
  lastFetchedAt: string | null;
  articlesLast24h: number;
  campaignsCreated: number;
};

export type PipelineFunnel = {
  fetched: number;
  classified: number;
  extracted: number;
  published: number;
};

export type ClassificationReviewItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  category: string | null;
  relevanceScore: number | null;
  adminFlagged: boolean;
  adminOverrideCategory: string | null;
  adminNotes: string | null;
  fetchedAt: string;
};

export type PipelineHealth = {
  sourceStatuses: SourceStatus[];
  funnel24h: PipelineFunnel;
  reviewQueue: ClassificationReviewItem[];
  cronHealth: CronRunStatus[];
};

export type CronRunStatus = {
  eventType: string;
  lastRun: string | null;
  lastSeverity: string | null;
  runsLast24h: number;
  errorsLast24h: number;
};

export async function getPipelineHealth(): Promise<PipelineHealth> {
  const [sourceStatuses, funnel24h, reviewQueue, cronHealth] =
    await Promise.all([
      getSourceStatuses(),
      getPipelineFunnel(),
      getReviewQueue(),
      getCronHealth(),
    ]);

  return { sourceStatuses, funnel24h, reviewQueue, cronHealth };
}

async function getSourceStatuses(): Promise<SourceStatus[]> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      source: schema.newsItems.source,
      lastFetchedAt: sql<Date | string | null>`max(${schema.newsItems.fetchedAt})`,
      articlesLast24h: sql<number>`count(*) filter (where ${schema.newsItems.fetchedAt} >= ${oneDayAgo.toISOString()})::int`,
      campaignsCreated: sql<number>`count(*) filter (where ${schema.newsItems.campaignCreated} = true)::int`,
    })
    .from(schema.newsItems)
    .groupBy(schema.newsItems.source)
    .orderBy(sql`max(${schema.newsItems.fetchedAt}) desc`);

  return rows.map((r) => ({
    source: r.source,
    lastFetchedAt: r.lastFetchedAt instanceof Date
      ? r.lastFetchedAt.toISOString()
      : r.lastFetchedAt ? String(r.lastFetchedAt) : null,
    articlesLast24h: r.articlesLast24h,
    campaignsCreated: r.campaignsCreated,
  }));
}

async function getPipelineFunnel(): Promise<PipelineFunnel> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [fetchedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.newsItems)
    .where(gte(schema.newsItems.fetchedAt, oneDayAgo));

  const [classifiedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.newsItems)
    .where(
      and(
        gte(schema.newsItems.fetchedAt, oneDayAgo),
        sql`${schema.newsItems.relevanceScore} IS NOT NULL`,
      ),
    );

  const [extractedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.newsItems)
    .where(
      and(
        gte(schema.newsItems.fetchedAt, oneDayAgo),
        eq(schema.newsItems.campaignCreated, true),
      ),
    );

  const [publishedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.campaigns)
    .where(
      and(
        eq(schema.campaigns.source, 'automated'),
        gte(schema.campaigns.publishedAt, oneDayAgo),
      ),
    );

  return {
    fetched: fetchedResult.count,
    classified: classifiedResult.count,
    extracted: extractedResult.count,
    published: publishedResult.count,
  };
}

async function getReviewQueue(): Promise<ClassificationReviewItem[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const items = await db
    .select({
      id: schema.newsItems.id,
      title: schema.newsItems.title,
      url: schema.newsItems.url,
      source: schema.newsItems.source,
      category: schema.newsItems.category,
      relevanceScore: schema.newsItems.relevanceScore,
      adminFlagged: schema.newsItems.adminFlagged,
      adminOverrideCategory: schema.newsItems.adminOverrideCategory,
      adminNotes: schema.newsItems.adminNotes,
      fetchedAt: schema.newsItems.fetchedAt,
    })
    .from(schema.newsItems)
    .where(
      and(
        gte(schema.newsItems.fetchedAt, sevenDaysAgo),
        sql`${schema.newsItems.relevanceScore} >= 50`,
        eq(schema.newsItems.campaignCreated, false),
      ),
    )
    .orderBy(desc(schema.newsItems.relevanceScore))
    .limit(50);

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    source: item.source,
    category: item.category,
    relevanceScore: item.relevanceScore,
    adminFlagged: item.adminFlagged,
    adminOverrideCategory: item.adminOverrideCategory,
    adminNotes: item.adminNotes,
    fetchedAt: item.fetchedAt.toISOString(),
  }));
}

async function getCronHealth(): Promise<CronRunStatus[]> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cronEventTypes = [
    'cron.simulate_donations',
    'cron.update_phases',
    'cron.ingest_news',
    'cron.fetch_news',
    'cron.reconcile',
    'cron.send_newsletter',
  ];

  const results: CronRunStatus[] = [];

  for (const eventType of cronEventTypes) {
    const [lastRun] = await db
      .select({
        timestamp: schema.auditLogs.timestamp,
        severity: schema.auditLogs.severity,
      })
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.eventType, eventType))
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(1);

    const [counts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        errors: sql<number>`count(*) filter (where ${schema.auditLogs.severity} IN ('error', 'critical'))::int`,
      })
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.eventType, eventType),
          gte(schema.auditLogs.timestamp, oneDayAgo),
        ),
      );

    results.push({
      eventType,
      lastRun: lastRun?.timestamp?.toISOString() ?? null,
      lastSeverity: lastRun?.severity ?? null,
      runsLast24h: counts.total,
      errorsLast24h: counts.errors,
    });
  }

  return results;
}
