import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bulkEmails, donations, donorCampaignSubscriptions, auditLogs } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { resend } from '@/lib/resend';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';
import type { UserRole } from '@/types';

const FROM_ADDRESS = 'LastDonor.org <noreply@lastdonor.org>';

type RouteParams = { params: Promise<{ id: string }> };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/admin/bulk-emails/[id]/send — Check send status of a bulk email.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const { id } = await params;

  try {
    await requireRole(['admin']);

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid bulk email ID', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const [email] = await db
      .select()
      .from(bulkEmails)
      .where(eq(bulkEmails.id, id))
      .limit(1);

    if (!email) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Bulk email not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: email.id,
        status: email.status,
        recipientCount: email.recipientCount,
        sentCount: email.sentCount,
        failedCount: email.failedCount,
        startedAt: email.startedAt,
        completedAt: email.completedAt,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError, { status: 403 });
    }
    console.error('[GET /api/v1/admin/bulk-emails/[id]/send]', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to check status', requestId } } satisfies ApiError, { status: 500 });
  }
}

/**
 * POST /api/v1/admin/bulk-emails/[id]/send — Trigger sending a draft bulk email.
 *
 * Resolves recipients from the associated campaign's donation records,
 * interpolates {{variables}} per recipient, and sends emails via Resend.
 * Updates sentCount/failedCount as it goes.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const { id } = await params;

  try {
    const session = await requireRole(['admin']);

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid bulk email ID', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const [email] = await db
      .select()
      .from(bulkEmails)
      .where(eq(bulkEmails.id, id))
      .limit(1);

    if (!email) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Bulk email not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    if (email.status !== 'draft') {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: `Cannot send a bulk email with status "${email.status}"`, requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    // Mark as sending
    await db.update(bulkEmails).set({
      status: 'sending',
      startedAt: new Date(),
    }).where(eq(bulkEmails.id, id));

    // Resolve unique recipients
    const recipients = await resolveRecipients(email.campaignId);

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      const interpolatedSubject = interpolate(email.subject, recipient);
      const interpolatedBody = interpolate(email.bodyHtml, recipient);

      try {
        const { error: sendError } = await resend.emails.send({
          from: FROM_ADDRESS,
          to: recipient.email,
          subject: interpolatedSubject,
          html: interpolatedBody,
        });

        if (sendError) {
          failedCount++;
          console.error(`[bulk-email] Failed to send to ${recipient.email}:`, sendError);
        } else {
          sentCount++;
        }
      } catch {
        failedCount++;
      }

      // Update progress periodically (every 10 emails)
      if ((sentCount + failedCount) % 10 === 0) {
        await db.update(bulkEmails).set({ sentCount, failedCount }).where(eq(bulkEmails.id, id));
      }
    }

    // Final update
    const finalStatus = failedCount === 0 ? 'completed' : (sentCount === 0 ? 'failed' : 'completed');
    await db.update(bulkEmails).set({
      sentCount,
      failedCount,
      recipientCount: recipients.length,
      status: finalStatus as 'completed' | 'failed',
      completedAt: new Date(),
    }).where(eq(bulkEmails.id, id));

    await db.insert(auditLogs).values({
      eventType: 'bulk_email.sent',
      actorId: session.user?.id ?? null,
      actorRole: session.user?.role as UserRole,
      targetType: 'bulk_email',
      targetId: id,
      severity: 'info',
      details: { sentCount, failedCount, recipientCount: recipients.length },
    });

    return NextResponse.json({
      ok: true,
      data: { id, status: finalStatus, sentCount, failedCount, recipientCount: recipients.length },
    });
  } catch (error) {
    // On unhandled error, mark as failed
    await db.update(bulkEmails).set({ status: 'failed' }).where(eq(bulkEmails.id, id)).catch(() => {});

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError, { status: 403 });
    }
    console.error('[POST /api/v1/admin/bulk-emails/[id]/send]', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send bulk email', requestId } } satisfies ApiError, { status: 500 });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

type EmailRecipient = {
  email: string;
  name: string;
  donationAmount?: number;
  campaignTitle?: string;
};

/** Resolve unique recipients from campaign donations. */
async function resolveRecipients(campaignId: string | null): Promise<EmailRecipient[]> {
  const conditions = [
    eq(donations.source, 'real'),
    eq(donations.refunded, false),
  ];

  if (campaignId) {
    conditions.push(eq(donations.campaignId, campaignId));
  }

  const rows = await db
    .select({
      donorEmail: donations.donorEmail,
      donorName: donations.donorName,
      amount: donations.amount,
    })
    .from(donations)
    .where(and(...conditions));

  // Deduplicate by email, keeping the largest donation for display
  const byEmail = new Map<string, EmailRecipient>();
  for (const row of rows) {
    const existing = byEmail.get(row.donorEmail);
    if (!existing || (row.amount > (existing.donationAmount ?? 0))) {
      byEmail.set(row.donorEmail, {
        email: row.donorEmail,
        name: row.donorName || 'Donor',
        donationAmount: row.amount,
      });
    }
  }

  return Array.from(byEmail.values());
}

/** Replace {{variable}} placeholders with recipient-specific values. */
function interpolate(template: string, recipient: EmailRecipient): string {
  return template
    .replace(/\{\{donor_name\}\}/gi, recipient.name)
    .replace(/\{\{donation_amount\}\}/gi, recipient.donationAmount ? `$${(recipient.donationAmount / 100).toFixed(2)}` : '')
    .replace(/\{\{campaign_title\}\}/gi, recipient.campaignTitle ?? '')
    .replace(/\{\{support_channels\}\}/gi, 'Email: support@lastdonor.org');
}
