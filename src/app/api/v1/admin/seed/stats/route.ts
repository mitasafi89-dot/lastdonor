import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/db';
import { donations, campaignSeedMessages } from '@/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function GET() {
  const requestId = randomUUID();

  try {
    await requireRole(['admin']);

    const [seedStats] = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalAmount: sql<number>`coalesce(sum(${donations.amount}), 0)::int`,
      })
      .from(donations)
      .where(and(eq(donations.source, 'seed'), eq(donations.refunded, false)));

    const [realStats] = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalAmount: sql<number>`coalesce(sum(${donations.amount}), 0)::int`,
      })
      .from(donations)
      .where(and(eq(donations.source, 'real'), eq(donations.refunded, false)));

    const [messageStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        used: sql<number>`count(*) filter (where ${campaignSeedMessages.used} = true)::int`,
        unused: sql<number>`count(*) filter (where ${campaignSeedMessages.used} = false)::int`,
      })
      .from(campaignSeedMessages);

    return NextResponse.json({
      ok: true,
      data: {
        seed: {
          count: seedStats.count,
          totalAmount: seedStats.totalAmount,
        },
        real: {
          count: realStats.count,
          totalAmount: realStats.totalAmount,
        },
        messages: {
          total: messageStats.total,
          used: messageStats.used,
          unused: messageStats.unused,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'UnauthorizedError' || error.name === 'ForbiddenError')) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: error.name === 'UnauthorizedError' ? 'UNAUTHORIZED' : 'FORBIDDEN',
            message: error.message,
            requestId,
          },
        },
        { status: error.name === 'UnauthorizedError' ? 401 : 403 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve seed stats',
          requestId,
        },
      },
      { status: 500 },
    );
  }
}
