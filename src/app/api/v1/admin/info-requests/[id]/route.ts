import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { infoRequests, campaigns, users, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth';
import { createAndEmail } from '@/lib/notifications';
import { infoRequestReminderEmail } from '@/lib/email-templates';
import { randomUUID } from 'crypto';
import type { ApiError } from '@/types/api';
import { infoRequestActionSchema } from '@/lib/validators/admin';

type RouteParams = { params: Promise<{ id: string }> };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/v1/admin/info-requests/[id]
 *
 * Admin actions: close, extend_deadline, send_reminder
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid info request ID', requestId } } satisfies ApiError,
      { status: 400 },
    );
  }

  try {
    const session = await requireRole(['admin']);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Request body required', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const parsed = infoRequestActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input', requestId } } satisfies ApiError,
        { status: 400 },
      );
    }

    const { action } = parsed.data;

    // Fetch the info request with campaign + target user info
    const [infoReq] = await db
      .select({
        id: infoRequests.id,
        campaignId: infoRequests.campaignId,
        campaignTitle: campaigns.title,
        targetUser: infoRequests.targetUser,
        targetName: users.name,
        targetEmail: users.email,
        requestType: infoRequests.requestType,
        details: infoRequests.details,
        deadline: infoRequests.deadline,
        status: infoRequests.status,
        reminderSent: infoRequests.reminderSent,
      })
      .from(infoRequests)
      .innerJoin(campaigns, eq(infoRequests.campaignId, campaigns.id))
      .innerJoin(users, eq(infoRequests.targetUser, users.id))
      .where(eq(infoRequests.id, id))
      .limit(1);

    if (!infoReq) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Info request not found', requestId } } satisfies ApiError,
        { status: 404 },
      );
    }

    // ── CLOSE ────────────────────────────────────────────────────────────
    if (action === 'close') {
      if (infoReq.status === 'closed') {
        return NextResponse.json(
          { ok: false, error: { code: 'CONFLICT', message: 'Info request is already closed', requestId } } satisfies ApiError,
          { status: 409 },
        );
      }

      await db.update(infoRequests).set({ status: 'closed' }).where(eq(infoRequests.id, id));

      // If campaign verificationStatus is info_requested, transition back
      const [campaign] = await db
        .select({ verificationStatus: campaigns.verificationStatus })
        .from(campaigns)
        .where(eq(campaigns.id, infoReq.campaignId))
        .limit(1);

      if (campaign?.verificationStatus === 'info_requested') {
        await db.update(campaigns).set({
          verificationStatus: 'submitted_for_review',
          updatedAt: new Date(),
        }).where(eq(campaigns.id, infoReq.campaignId));
      }

      await db.insert(auditLogs).values({
        eventType: 'info_request.closed',
        actorId: session.user.id,
        actorRole: 'admin',
        targetType: 'campaign',
        targetId: infoReq.campaignId,
        severity: 'info',
        details: { infoRequestId: id },
      });

      return NextResponse.json({ ok: true, data: { id, status: 'closed' } });
    }

    // ── EXTEND DEADLINE ──────────────────────────────────────────────────
    if (action === 'extend_deadline') {
      const { additionalDays } = body as { additionalDays?: number };

      if (!additionalDays || typeof additionalDays !== 'number' || additionalDays < 1 || additionalDays > 90) {
        return NextResponse.json(
          { ok: false, error: { code: 'VALIDATION_ERROR', message: 'additionalDays must be between 1 and 90', requestId } } satisfies ApiError,
          { status: 400 },
        );
      }

      if (infoReq.status === 'closed') {
        return NextResponse.json(
          { ok: false, error: { code: 'CONFLICT', message: 'Cannot extend deadline on a closed request', requestId } } satisfies ApiError,
          { status: 409 },
        );
      }

      const currentDeadline = new Date(infoReq.deadline);
      const newDeadline = new Date(Math.max(currentDeadline.getTime(), Date.now()));
      newDeadline.setDate(newDeadline.getDate() + additionalDays);

      // If expired, reopen to pending
      const newStatus = infoReq.status === 'expired' ? 'pending' : infoReq.status;

      await db.update(infoRequests).set({
        deadline: newDeadline,
        ...(newStatus !== infoReq.status ? { status: newStatus as 'pending' } : {}),
      }).where(eq(infoRequests.id, id));

      await db.insert(auditLogs).values({
        eventType: 'info_request.deadline_extended',
        actorId: session.user.id,
        actorRole: 'admin',
        targetType: 'campaign',
        targetId: infoReq.campaignId,
        severity: 'info',
        details: { infoRequestId: id, additionalDays, newDeadline: newDeadline.toISOString() },
      });

      return NextResponse.json({
        ok: true,
        data: { id, deadline: newDeadline.toISOString(), status: newStatus },
      });
    }

    // ── SEND REMINDER ────────────────────────────────────────────────────
    if (action === 'send_reminder') {
      if (infoReq.status !== 'pending') {
        return NextResponse.json(
          { ok: false, error: { code: 'CONFLICT', message: 'Can only send reminders for pending requests', requestId } } satisfies ApiError,
          { status: 409 },
        );
      }

      const daysLeft = Math.max(1, Math.ceil((new Date(infoReq.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

      const emailContent = infoRequestReminderEmail({
        campaignerName: infoReq.targetName || 'Campaigner',
        campaignTitle: infoReq.campaignTitle,
        daysLeft,
        campaignId: infoReq.campaignId,
      });

      await createAndEmail({
        userId: infoReq.targetUser,
        type: 'info_request_reminder',
        title: `Reminder: Respond to information request for "${infoReq.campaignTitle}"`,
        message: `You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} left to respond.`,
        link: `/dashboard/campaigns/${infoReq.campaignId}/verification`,
        email: { to: infoReq.targetEmail!, ...emailContent },
      });

      await db.update(infoRequests).set({ reminderSent: true }).where(eq(infoRequests.id, id));

      await db.insert(auditLogs).values({
        eventType: 'info_request.reminder_sent',
        actorId: session.user.id,
        actorRole: 'admin',
        targetType: 'campaign',
        targetId: infoReq.campaignId,
        severity: 'info',
        details: { infoRequestId: id, daysLeft },
      });

      return NextResponse.json({ ok: true, data: { id, reminderSent: true } });
    }

    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Unknown action', requestId } } satisfies ApiError,
      { status: 400 },
    );
  } catch (error) {
    if ((error as Error).name === 'UnauthorizedError') {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } } satisfies ApiError,
        { status: 401 },
      );
    }
    if ((error as Error).name === 'ForbiddenError') {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required', requestId } } satisfies ApiError,
        { status: 403 },
      );
    }
    console.error('[PATCH /api/v1/admin/info-requests/[id]]', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process info request action', requestId } } satisfies ApiError,
      { status: 500 },
    );
  }
}
