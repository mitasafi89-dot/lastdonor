import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/db';
import { campaigns, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateInitialMessages } from '@/lib/seed/message-generator';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const bodySchema = z.object({
  campaignId: z.string().uuid(),
  count: z.number().int().min(10).max(500).optional().default(100),
});

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const session = await requireRole(['admin']);

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors[0].message,
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const { campaignId, count } = parsed.data;

    // Verify campaign exists
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Campaign not found',
            requestId,
          },
        },
        { status: 404 },
      );
    }

    const generated = await generateInitialMessages(campaign);

    await db.insert(auditLogs).values({
      eventType: 'admin.seed_messages_generated',
      actorId: session.user.id,
      actorRole: 'admin',
      targetType: 'campaign',
      targetId: campaignId,
      severity: 'info',
      details: { generated, requestedCount: count },
    });

    return NextResponse.json({
      ok: true,
      data: { generated },
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'UnauthorizedError' || error.name === 'ForbiddenError')) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: error.name === 'UnauthorizedError' ? 'UNAUTHORIZED' : 'FORBIDDEN',
            message: error.message,
            requestId,
          },
        },
        { status: error.name === 'UnauthorizedError' ? 401 : 403 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate messages',
          requestId,
        },
      },
      { status: 500 },
    );
  }
}
