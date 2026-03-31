import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, ilike, or, desc, sql, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

export async function GET(request: NextRequest) {
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

  const { searchParams } = request.nextUrl;
  const search = searchParams.get('search')?.trim() ?? '';
  const roleFilter = searchParams.get('role');
  const sortBy = searchParams.get('sort') ?? 'createdAt';
  const cursor = searchParams.get('cursor');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);

  const conditions = [];

  if (search.length > 0) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(users.name, pattern),
        ilike(users.email, pattern),
      ),
    );
  }

  if (roleFilter && ['donor', 'editor', 'admin'].includes(roleFilter)) {
    conditions.push(eq(users.role, roleFilter as 'donor' | 'editor' | 'admin'));
  }

  if (cursor) {
    conditions.push(sql`${users.id} < ${cursor}`);
  }

  const orderColumn =
    sortBy === 'totalDonated' ? desc(users.totalDonated) :
    sortBy === 'name' ? sql`${users.name} ASC NULLS LAST` :
    desc(users.createdAt);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      totalDonated: users.totalDonated,
      campaignsSupported: users.campaignsSupported,
      lastDonorCount: users.lastDonorCount,
      createdAt: users.createdAt,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderColumn)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  // Get total count for the current filter
  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  // Get role breakdown
  const roleCounts = await db
    .select({
      role: users.role,
      count: sql<number>`count(*)::int`,
    })
    .from(users)
    .groupBy(users.role);

  return NextResponse.json({
    ok: true,
    data: rows,
    meta: {
      hasMore,
      cursor: rows[rows.length - 1]?.id ?? null,
      total: totalCount,
      roleCounts: Object.fromEntries(roleCounts.map((r) => [r.role, r.count])),
    },
  });
}
