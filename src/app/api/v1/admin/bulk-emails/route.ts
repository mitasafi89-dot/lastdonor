import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bulkEmails, campaigns, donations, donorCampaignSubscriptions, auditLogs } from '@/db/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { createBulkEmailSchema, bulkEmailQuerySchema } from '@/lib/validators/verification';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';
import type { UserRole } from '@/types';

/**
 * GET /api/v1/admin/bulk-emails — List all bulk emails with pagination.
 */
export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  try {
    await requireRole(['admin']);

    const url = new URL(request.url);
    const query = bulkEmailQuerySchema.parse({
      status: url.searchParams.get('status') ?? undefined,
      page: url.searchParams.get('page') ? Number(url.searchParams.get('page')) : undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
    });

    const { status, page, limit } = query;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) {
      conditions.push(eq(bulkEmails.status, status as 'draft' | 'sending' | 'completed' | 'failed'));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(bulkEmails)
        .where(where)
        .orderBy(desc(bulkEmails.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(bulkEmails)
        .where(where),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        items: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError, { status: 403 });
    }
    console.error('[GET /api/v1/admin/bulk-emails]', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list bulk emails', requestId } } satisfies ApiError, { status: 500 });
  }
}

/**
 * POST /api/v1/admin/bulk-emails — Create a new bulk email (draft).
 *
 * Counts recipients based on the filter and campaign, stores the draft.
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const session = await requireRole(['admin']);

    const body = await request.json().catch(() => null);
    const parsed = createBulkEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request body', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { templateName, campaignId, subject, bodyHtml, recipientFilter } = parsed.data;

    // Count recipients based on filter
    const recipientCount = await countRecipients(recipientFilter, campaignId);

    const [bulkEmail] = await db.insert(bulkEmails).values({
      sentBy: session.user?.id ?? '',
      templateName,
      subject,
      bodyHtml,
      recipientCount,
      campaignId: campaignId ?? null,
    }).returning();

    await db.insert(auditLogs).values({
      eventType: 'bulk_email.created',
      actorId: session.user?.id ?? null,
      actorRole: session.user?.role as UserRole,
      targetType: 'bulk_email',
      targetId: bulkEmail.id,
      severity: 'info',
      details: { templateName, campaignId, recipientFilter, recipientCount },
    });

    return NextResponse.json({ ok: true, data: bulkEmail }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError, { status: 403 });
    }
    console.error('[POST /api/v1/admin/bulk-emails]', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create bulk email', requestId } } satisfies ApiError, { status: 500 });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function countRecipients(
  filter: string,
  campaignId?: string,
): Promise<number> {
  // Base: all real, un-refunded donations for this campaign (or all campaigns)
  const conditions = [
    eq(donations.source, 'real'),
    eq(donations.refunded, false),
  ];

  if (campaignId) {
    conditions.push(eq(donations.campaignId, campaignId));
  }

  if (filter === 'refunded_donors') {
    // Override: refunded donations
    conditions[1] = eq(donations.refunded, true);
  }

  if (filter === 'subscribed_donors' && campaignId) {
    // Count from subscriptions table instead
    const [{ total }] = await db
      .select({ total: count() })
      .from(donorCampaignSubscriptions)
      .where(
        and(
          eq(donorCampaignSubscriptions.campaignId, campaignId),
          eq(donorCampaignSubscriptions.subscribed, true),
        ),
      );
    return total;
  }

  if (filter === 'registered_donors') {
    conditions.push(sql`${donations.userId} IS NOT NULL`);
  } else if (filter === 'guest_donors') {
    conditions.push(sql`${donations.userId} IS NULL`);
  }

  // Count unique emails to avoid duplicates
  const [{ total }] = await db
    .select({ total: sql<number>`count(DISTINCT ${donations.donorEmail})` })
    .from(donations)
    .where(and(...conditions));

  return Number(total);
}
