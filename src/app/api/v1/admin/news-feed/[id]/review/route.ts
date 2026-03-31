import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/db';
import { newsItems, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';

export const dynamic = 'force-dynamic';

const reviewSchema = z.object({
  adminFlagged: z.boolean().optional(),
  adminOverrideCategory: z
    .enum([
      'medical', 'disaster', 'military', 'veterans', 'memorial',
      'first-responders', 'community', 'essential-needs', 'emergency',
      'charity', 'education', 'animal', 'environment', 'business',
      'competition', 'creative', 'event', 'faith', 'family',
      'sports', 'travel', 'volunteer', 'wishes',
    ])
    .nullable()
    .optional(),
  adminNotes: z.string().max(2000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    const error: ApiError = {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
        requestId,
      },
    };
    return NextResponse.json(error, { status: 400 });
  }

  // Build update object from provided fields only
  const updates: Record<string, unknown> = {};
  if (parsed.data.adminFlagged !== undefined) updates.adminFlagged = parsed.data.adminFlagged;
  if (parsed.data.adminOverrideCategory !== undefined) updates.adminOverrideCategory = parsed.data.adminOverrideCategory;
  if (parsed.data.adminNotes !== undefined) updates.adminNotes = parsed.data.adminNotes;

  if (Object.keys(updates).length === 0) {
    const error: ApiError = {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'No fields to update', requestId },
    };
    return NextResponse.json(error, { status: 400 });
  }

  const [updated] = await db
    .update(newsItems)
    .set(updates)
    .where(eq(newsItems.id, id))
    .returning({ id: newsItems.id });

  if (!updated) {
    const error: ApiError = {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'News item not found', requestId },
    };
    return NextResponse.json(error, { status: 404 });
  }

  await db.insert(auditLogs).values({
    eventType: 'admin.news_item_review',
    severity: 'info',
    details: { newsItemId: id, updates, requestId },
  });

  return NextResponse.json({ ok: true, data: { id: updated.id } });
}
