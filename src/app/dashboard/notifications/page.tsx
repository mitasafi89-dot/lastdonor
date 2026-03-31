import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { NotificationsClient } from '@/app/notifications/NotificationsClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notifications — Dashboard — LastDonor.org',
  robots: { index: false },
};

export default async function DashboardNotificationsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/login?callbackUrl=/dashboard/notifications');

  const [items, [countRow], [unreadRow]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        link: notifications.link,
        read: notifications.read,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(200),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(eq(notifications.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false))),
  ]);

  const serialized = items.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {countRow.count} total &middot; {unreadRow.count} unread
        </p>
      </div>
      <NotificationsClient
        notifications={serialized}
        totalCount={countRow.count}
        unreadCount={unreadRow.count}
      />
    </>
  );
}
