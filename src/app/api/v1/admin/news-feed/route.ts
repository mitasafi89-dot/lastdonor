import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/db';
import { newsItems } from '@/db/schema';
import { desc, gte, eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  try {
    await requireRole(['editor', 'admin']);
  } catch {
    const error: ApiError = {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Editor or admin access required', requestId },
    };
    return NextResponse.json(error, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const source = searchParams.get('source');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);
  const sinceHours = parseInt(searchParams.get('since') ?? '24', 10) || 24;
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  const conditions = [gte(newsItems.fetchedAt, since)];
  if (source) conditions.push(eq(newsItems.source, source));

  const items = await db
    .select()
    .from(newsItems)
    .where(and(...conditions))
    .orderBy(desc(newsItems.fetchedAt))
    .limit(limit);

  return NextResponse.json({
    ok: true,
    data: items,
  });
}
