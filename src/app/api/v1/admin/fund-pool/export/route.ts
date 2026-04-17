import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fundPoolAllocations, campaigns } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

/**
 * GET /api/v1/admin/fund-pool/export - Export fund pool data as CSV.
 */
export async function GET(_request: NextRequest) {
  const requestId = randomUUID();

  try {
    await requireRole(['admin']);

    // Fetch all allocations with joined campaign titles
    // Use aliased joins for source and target campaigns
    const rows = await db
      .select({
        id: fundPoolAllocations.id,
        donationId: fundPoolAllocations.donationId,
        sourceCampaignId: fundPoolAllocations.sourceCampaignId,
        sourceCampaignTitle: campaigns.title,
        targetCampaignId: fundPoolAllocations.targetCampaignId,
        amount: fundPoolAllocations.amount,
        status: fundPoolAllocations.status,
        notes: fundPoolAllocations.notes,
        allocatedAt: fundPoolAllocations.allocatedAt,
        disbursedAt: fundPoolAllocations.disbursedAt,
        createdAt: fundPoolAllocations.createdAt,
      })
      .from(fundPoolAllocations)
      .innerJoin(campaigns, eq(fundPoolAllocations.sourceCampaignId, campaigns.id))
      .orderBy(desc(fundPoolAllocations.createdAt));

    // Build CSV
    const header = 'Allocation ID,Donation ID,Amount (cents),Amount ($),Source Campaign,Target Campaign ID,Status,Notes,Created,Allocated,Disbursed';
    const csvRows = rows.map(r => {
      const escapeCsv = (val: string | null | undefined) => {
        if (val == null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        r.id,
        r.donationId,
        r.amount,
        (r.amount / 100).toFixed(2),
        escapeCsv(r.sourceCampaignTitle),
        r.targetCampaignId ?? '',
        r.status,
        escapeCsv(r.notes),
        r.createdAt?.toISOString() ?? '',
        r.allocatedAt?.toISOString() ?? '',
        r.disbursedAt?.toISOString() ?? '',
      ].join(',');
    });

    const csv = [header, ...csvRows].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="fund-pool-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error('[GET /api/v1/admin/fund-pool/export]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
