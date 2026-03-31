import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/db';
import { interactionLogs, users, auditLogs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { createInteractionSchema } from '@/lib/validators/donor';
import type { ApiError } from '@/types/api';
import type { UserRole } from '@/types';

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

  const interactions = await db
    .select({
      id: interactionLogs.id,
      type: interactionLogs.type,
      subject: interactionLogs.subject,
      body: interactionLogs.body,
      contactedAt: interactionLogs.contactedAt,
      createdAt: interactionLogs.createdAt,
      staffId: interactionLogs.staffId,
      staffName: users.name,
      staffEmail: users.email,
    })
    .from(interactionLogs)
    .leftJoin(users, eq(interactionLogs.staffId, users.id))
    .where(eq(interactionLogs.donorId, id))
    .orderBy(desc(interactionLogs.contactedAt))
    .limit(50);

  return NextResponse.json({ ok: true, data: interactions });
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

  const parsed = createInteractionSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: firstIssue.message, field: firstIssue.path.join('.'), requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  // Verify donor exists
  const [donor] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, donorId))
    .limit(1);

  if (!donor) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Donor not found', requestId } } satisfies ApiError,
      { status: 404 },
    );
  }

  const [created] = await db
    .insert(interactionLogs)
    .values({
      donorId,
      staffId: session.user?.id ?? null,
      type: parsed.data.type,
      subject: parsed.data.subject,
      body: parsed.data.body ?? null,
      contactedAt: new Date(parsed.data.contactedAt),
    })
    .returning();

  await db.insert(auditLogs).values({
    eventType: 'interaction.logged',
    actorId: session.user?.id ?? null,
    actorRole: session.user?.role as UserRole,
    targetType: 'user',
    targetId: donorId,
    severity: 'info',
    details: { interactionId: created.id, type: parsed.data.type, subject: parsed.data.subject },
  });

  return NextResponse.json({ ok: true, data: created }, { status: 201 });
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

  const interactionId = request.nextUrl.searchParams.get('interactionId');
  if (!interactionId || !UUID_REGEX.test(interactionId)) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Valid interactionId query param required', requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: interactionLogs.id, donorId: interactionLogs.donorId })
    .from(interactionLogs)
    .where(eq(interactionLogs.id, interactionId))
    .limit(1);

  if (!existing || existing.donorId !== donorId) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Interaction not found', requestId } } satisfies ApiError,
      { status: 404 },
    );
  }

  await db.delete(interactionLogs).where(eq(interactionLogs.id, interactionId));

  await db.insert(auditLogs).values({
    eventType: 'interaction.deleted',
    actorId: session.user?.id ?? null,
    actorRole: session.user?.role as UserRole,
    targetType: 'user',
    targetId: donorId,
    severity: 'info',
    details: { interactionId },
  });

  return NextResponse.json({ ok: true, data: { deleted: interactionId } });
}
