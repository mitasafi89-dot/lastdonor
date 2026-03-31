import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/db';
import { donations, campaigns, newsletterSubscribers } from '@/db/schema';
import { eq, sql, gte, and, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

export async function GET() {
  const requestId = randomUUID();

  try {
    await requireRole(['admin']);
  } catch {
    const error: ApiError = {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required', requestId },
    };
    return NextResponse.json(error, { status: 403 });
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [todayDonations] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${donations.amount}), 0)::int`,
    })
    .from(donations)
    .where(
      and(
        gte(donations.createdAt, startOfDay),
        eq(donations.source, 'real'),
        eq(donations.refunded, false),
      ),
    );

  const [monthDonations] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${donations.amount}), 0)::int`,
    })
    .from(donations)
    .where(
      and(
        gte(donations.createdAt, startOfMonth),
        eq(donations.source, 'real'),
        eq(donations.refunded, false),
      ),
    );

  const [todaySubs] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(newsletterSubscribers)
    .where(gte(newsletterSubscribers.subscribedAt, startOfDay));

  const [monthSubs] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(newsletterSubscribers)
    .where(gte(newsletterSubscribers.subscribedAt, startOfMonth));

  // Daily donations for chart (last 30 days)
  const dailyDonations = await db
    .select({
      date: sql<string>`date_trunc('day', ${donations.createdAt})::date::text`,
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${donations.amount}), 0)::int`,
    })
    .from(donations)
    .where(
      and(
        gte(donations.createdAt, thirtyDaysAgo),
        eq(donations.source, 'real'),
        eq(donations.refunded, false),
      ),
    )
    .groupBy(sql`date_trunc('day', ${donations.createdAt})`)
    .orderBy(sql`date_trunc('day', ${donations.createdAt})`);

  return NextResponse.json({
    ok: true,
    data: {
      today: {
        donationCount: todayDonations.count,
        donationTotal: todayDonations.total,
        newSubscribers: todaySubs.count,
      },
      month: {
        donationCount: monthDonations.count,
        donationTotal: monthDonations.total,
        newSubscribers: monthSubs.count,
      },
      dailyDonations,
    },
  });
}
