import { NextRequest, NextResponse } from 'next/server';
import { requireRole, auth } from '@/lib/auth';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { desc, gte, lte, eq, and, lt } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  let session;
  try {
    session = await requireRole(['admin']);
  } catch {
    const error: ApiError = {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required', requestId },
    };
    return NextResponse.json(error, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const eventType = searchParams.get('eventType');
  const actorId = searchParams.get('actorId');
  const sinceParam = searchParams.get('since');
  const untilParam = searchParams.get('until');
  const cursor = searchParams.get('cursor');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);

  const since = sinceParam
    ? new Date(sinceParam)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const until = untilParam ? new Date(untilParam) : new Date();

  const conditions = [
    gte(auditLogs.timestamp, since),
    lte(auditLogs.timestamp, until),
  ];

  if (eventType) conditions.push(eq(auditLogs.eventType, eventType));
  if (actorId) conditions.push(eq(auditLogs.actorId, actorId));
  if (cursor) conditions.push(lt(auditLogs.id, cursor));

  const entries = await db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit + 1);

  const hasMore = entries.length > limit;
  if (hasMore) entries.pop();

  const lastEntry = entries[entries.length - 1];

  // Meta-logging: record this audit log access
  await db.insert(auditLogs).values({
    eventType: 'audit_log.viewed',
    actorId: session.user?.id ?? null,
    actorRole: session.user?.role as 'admin' | undefined,
    severity: 'info',
    details: { query: { eventType, actorId, since: since.toISOString(), limit } },
  });

  return NextResponse.json({
    ok: true,
    data: entries,
    meta: {
      hasMore,
      cursor: lastEntry?.id ?? null,
    },
  });
}
