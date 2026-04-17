import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/db';
import { donorRelationships, users, auditLogs } from '@/db/schema';
import { eq, desc, or, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { createRelationshipSchema } from '@/lib/validators/donor';
import type { ApiError } from '@/types/api';
import type { UserRole } from '@/types';
import { logError } from '@/lib/errors';

type RouteContext = { params: Promise<{ id: string }> };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = randomUUID();
  const { id } = await context.params;

  try {
    await requireRole(['admin']);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError,
      { status: 403 },
    );
  }

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid user ID format', requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
  // Fetch relationships where this donor is either side
  const relationships = await db
    .select({
      id: donorRelationships.id,
      donorId: donorRelationships.donorId,
      relatedDonorId: donorRelationships.relatedDonorId,
      organizationName: donorRelationships.organizationName,
      relationshipType: donorRelationships.relationshipType,
      notes: donorRelationships.notes,
      createdAt: donorRelationships.createdAt,
    })
    .from(donorRelationships)
    .where(
      or(
        eq(donorRelationships.donorId, id),
        eq(donorRelationships.relatedDonorId, id),
      ),
    )
    .orderBy(desc(donorRelationships.createdAt))
    .limit(50);

  // Resolve related donor names
  const relatedIds = new Set<string>();
  for (const r of relationships) {
    if (r.relatedDonorId) relatedIds.add(r.relatedDonorId);
    if (r.donorId !== id) relatedIds.add(r.donorId);
  }

  const relatedUsers: Record<string, { name: string | null; email: string }> = {};
  if (relatedIds.size > 0) {
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, [...relatedIds]));
    for (const u of rows) {
      relatedUsers[u.id] = { name: u.name, email: u.email };
    }
  }

  const enriched = relationships.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    relatedDonorName: r.relatedDonorId ? (relatedUsers[r.relatedDonorId]?.name ?? relatedUsers[r.relatedDonorId]?.email ?? null) : null,
  }));

  return NextResponse.json({ ok: true, data: enriched });
  } catch (err) {
    logError(err, 'admin-relationships-get', { requestId, userId: id });
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load relationships', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = randomUUID();
  const { id: donorId } = await context.params;

  let session;
  try {
    session = await requireRole(['admin']);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError,
      { status: 403 },
    );
  }

  if (!UUID_REGEX.test(donorId)) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid user ID format', requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body', requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  const parsed = createRelationshipSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: issue.message, field: issue.path.join('.'), requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  // Must have either relatedDonorId or organizationName
  if (!parsed.data.relatedDonorId && !parsed.data.organizationName) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Provide either a related donor or organization name', requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
  // Verify donor exists
  const [donor] = await db.select({ id: users.id }).from(users).where(eq(users.id, donorId)).limit(1);
  if (!donor) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Donor not found', requestId } } satisfies ApiError,
      { status: 404 },
    );
  }

  // If linking to another donor, verify they exist
  if (parsed.data.relatedDonorId) {
    const [related] = await db.select({ id: users.id }).from(users).where(eq(users.id, parsed.data.relatedDonorId)).limit(1);
    if (!related) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Related donor not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }
  }

  const [created] = await db
    .insert(donorRelationships)
    .values({
      donorId,
      relatedDonorId: parsed.data.relatedDonorId ?? null,
      organizationName: parsed.data.organizationName ?? null,
      relationshipType: parsed.data.relationshipType,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  await db.insert(auditLogs).values({
    eventType: 'relationship.created',
    actorId: session.user?.id ?? null,
    actorRole: session.user?.role as UserRole,
    targetType: 'user',
    targetId: donorId,
    severity: 'info',
    details: { relationshipId: created.id, type: parsed.data.relationshipType },
  });

  return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (err) {
    logError(err, 'admin-relationships-create', { requestId, donorId });
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create relationship', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = randomUUID();
  const { id: donorId } = await context.params;

  let session;
  try {
    session = await requireRole(['admin']);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError,
      { status: 403 },
    );
  }

  const relationshipId = request.nextUrl.searchParams.get('relationshipId');
  if (!relationshipId || !UUID_REGEX.test(relationshipId)) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Valid relationshipId query param required', requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
  const [existing] = await db
    .select({ id: donorRelationships.id, donorId: donorRelationships.donorId })
    .from(donorRelationships)
    .where(eq(donorRelationships.id, relationshipId))
    .limit(1);

  if (!existing || existing.donorId !== donorId) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Relationship not found', requestId } } satisfies ApiError,
      { status: 404 },
    );
  }

  await db.delete(donorRelationships).where(eq(donorRelationships.id, relationshipId));

  await db.insert(auditLogs).values({
    eventType: 'relationship.deleted',
    actorId: session.user?.id ?? null,
    actorRole: session.user?.role as UserRole,
    targetType: 'user',
    targetId: donorId,
    severity: 'info',
    details: { relationshipId },
  });

  return NextResponse.json({ ok: true, data: { deleted: relationshipId } });
  } catch (err) {
    logError(err, 'admin-relationships-delete', { requestId, donorId, relationshipId });
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete relationship', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
