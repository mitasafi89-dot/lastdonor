import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { NotificationsClient } from '@/app/notifications/NotificationsClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notifications — LastDonor.org',
  robots: { index: false },
};

export default async function NotificationsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/login');

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
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          {countRow.count} total &middot; {unreadRow.count} unread
        </p>
      </div>
      <NotificationsClient
        notifications={serialized}
        totalCount={countRow.count}
        unreadCount={unreadRow.count}
      />
    </div>
  );
}
