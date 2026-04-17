import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { donations, campaigns, auditLogs } from '@/db/schema';
import { eq, desc, sql, gte } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map((r) => r.map(escapeCSV).join(','));
  return [headerLine, ...dataLines].join('\n');
}

/**
 * GET /api/v1/admin/export/csv?type=donations|campaigns|monthly
 */
export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  try {
    await requireRole(['admin']);

    const type = request.nextUrl.searchParams.get('type') ?? 'donations';

    if (type === 'donations') {
      const rows = await db
        .select({
          id: donations.id,
          campaignTitle: campaigns.title,
          donorName: donations.donorName,
          donorEmail: donations.donorEmail,
          amount: donations.amount,
          phase: donations.phaseAtTime,
          source: donations.source,
          refunded: donations.refunded,
          isAnonymous: donations.isAnonymous,
          createdAt: donations.createdAt,
        })
        .from(donations)
        .leftJoin(campaigns, eq(donations.campaignId, campaigns.id))
        .orderBy(desc(donations.createdAt))
        .limit(10000);

      const csv = toCSV(
        ['ID', 'Campaign', 'Donor Name', 'Donor Email', 'Amount ($)', 'Phase', 'Source', 'Refunded', 'Anonymous', 'Date'],
        rows.map((r) => [
          r.id,
          r.campaignTitle ?? '',
          r.donorName,
          r.donorEmail,
          (r.amount / 100).toFixed(2),
          r.phase,
          r.source,
          r.refunded ? 'Yes' : 'No',
          r.isAnonymous ? 'Yes' : 'No',
          r.createdAt.toISOString(),
        ]),
      );

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="donations-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    if (type === 'campaigns') {
      const rows = await db
        .select({
          id: campaigns.id,
          title: campaigns.title,
          slug: campaigns.slug,
          status: campaigns.status,
          category: campaigns.category,
          goalAmount: campaigns.goalAmount,
          raisedAmount: campaigns.raisedAmount,
          donorCount: campaigns.donorCount,
          createdAt: campaigns.createdAt,
          publishedAt: campaigns.publishedAt,
        })
        .from(campaigns)
        .orderBy(desc(campaigns.createdAt))
        .limit(10000);

      const csv = toCSV(
        ['ID', 'Title', 'Slug', 'Status', 'Category', 'Goal ($)', 'Raised ($)', 'Donors', 'Created', 'Published'],
        rows.map((r) => [
          r.id,
          r.title,
          r.slug,
          r.status,
          r.category,
          (r.goalAmount / 100).toFixed(2),
          (r.raisedAmount / 100).toFixed(2),
          String(r.donorCount),
          r.createdAt.toISOString(),
          r.publishedAt?.toISOString() ?? '',
        ]),
      );

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="campaigns-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    if (type === 'monthly') {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const rows = await db
        .select({
          month: sql<string>`to_char(${donations.createdAt}, 'YYYY-MM')`,
          total: sql<number>`sum(${donations.amount})::int`,
          count: sql<number>`count(*)::int`,
          avgDonation: sql<number>`avg(${donations.amount})::int`,
        })
        .from(donations)
        .where(gte(donations.createdAt, twelveMonthsAgo))
        .groupBy(sql`to_char(${donations.createdAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${donations.createdAt}, 'YYYY-MM')`);

      const csv = toCSV(
        ['Month', 'Total Revenue ($)', 'Donation Count', 'Avg Donation ($)'],
        rows.map((r) => [
          r.month,
          ((r.total ?? 0) / 100).toFixed(2),
          String(r.count ?? 0),
          ((r.avgDonation ?? 0) / 100).toFixed(2),
        ]),
      );

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="monthly-revenue-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    if (type === 'auditlog') {
      const rows = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.timestamp))
        .limit(10000);

      const csv = toCSV(
        ['ID', 'Timestamp', 'Event Type', 'Actor ID', 'Actor Role', 'Target Type', 'Target ID', 'Severity', 'Details'],
        rows.map((r) => [
          r.id,
          r.timestamp.toISOString(),
          r.eventType,
          r.actorId ?? '',
          r.actorRole ?? '',
          r.targetType ?? '',
          r.targetId ?? '',
          r.severity,
          JSON.stringify(r.details ?? {}),
        ]),
      );

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    const body: ApiError = {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid export type. Use: donations, campaigns, monthly, or auditlog',
        requestId,
      },
    };
    return NextResponse.json(body, { status: 400 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error('[GET /api/v1/admin/export/csv]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Export failed', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
