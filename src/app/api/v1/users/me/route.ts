import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, donations, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { updateProfileSchema } from '@/lib/validators/user';
import { resend } from '@/lib/resend';
import { randomUUID } from 'crypto';
import type { ApiError, ApiResponse } from '@/types/api';

export async function GET() {
  const requestId = randomUUID();

  const session = await auth();
  if (!session?.user?.id) {
    const error: ApiError = {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated', requestId },
    };
    return NextResponse.json(error, { status: 401 });
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      location: users.location,
      avatarUrl: users.avatarUrl,
      role: users.role,
      totalDonated: users.totalDonated,
      campaignsSupported: users.campaignsSupported,
      lastDonorCount: users.lastDonorCount,
      badges: users.badges,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    const error: ApiError = {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User not found', requestId },
    };
    return NextResponse.json(error, { status: 404 });
  }

  const response: ApiResponse<typeof user> = { ok: true, data: user };
  return NextResponse.json(response);
}

export async function PUT(request: NextRequest) {
  const requestId = randomUUID();

  const session = await auth();
  if (!session?.user?.id) {
    const error: ApiError = {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated', requestId },
    };
    return NextResponse.json(error, { status: 401 });
  }

  const body = await request.json();
  const result = updateProfileSchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.errors[0];
    const error: ApiError = {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: firstError?.message ?? 'Invalid input',
        field: firstError?.path.join('.'),
        requestId,
      },
    };
    return NextResponse.json(error, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set(result.data)
    .where(eq(users.id, session.user.id))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      location: users.location,
      avatarUrl: users.avatarUrl,
    });

  const response: ApiResponse<typeof updated> = { ok: true, data: updated };
  return NextResponse.json(response);
}

export async function DELETE(request: NextRequest) {
  const requestId = randomUUID();

  const session = await auth();
  if (!session?.user?.id) {
    const error: ApiError = {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated', requestId },
    };
    return NextResponse.json(error, { status: 401 });
  }

  const body = await request.json();
  if (body?.confirm !== true) {
    const error: ApiError = {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Confirmation required. Send { "confirm": true }.',
        requestId,
      },
    };
    return NextResponse.json(error, { status: 400 });
  }

  const userId = session.user.id;
  const userEmail = session.user.email;

  // Anonymize donations
  await db
    .update(donations)
    .set({
      donorName: 'Deleted User',
      donorEmail: 'deleted@lastdonor.org',
      message: null,
    })
    .where(eq(donations.userId, userId));

  // Delete user
  await db.delete(users).where(eq(users.id, userId));

  // Audit log
  await db.insert(auditLogs).values({
    eventType: 'user.deleted',
    actorId: userId,
    targetType: 'user',
    targetId: userId,
    severity: 'warning',
    details: { email: userEmail },
  });

  // Send confirmation email
  if (userEmail) {
    try {
      await resend.emails.send({
        from: 'LastDonor.org <noreply@lastdonor.org>',
        to: userEmail,
        subject: 'Your LastDonor.org account has been deleted',
        text: 'Your account has been permanently deleted and your donation records have been anonymized. If you did not request this, please contact support@lastdonor.org immediately.',
      });
    } catch {
      // Don't fail the deletion if email fails
    }
  }

  return NextResponse.json({ ok: true, data: null });
}
