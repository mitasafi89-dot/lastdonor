import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import ProfilePageClient from '@/components/user/ProfilePageClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile — LastDonor.org',
  robots: { index: false },
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/profile');

  const [user] = await db
    .select({
      name: users.name,
      email: users.email,
      location: users.location,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) redirect('/login');

  return (
    <ProfilePageClient
      profile={{
        name: user.name ?? '',
        email: user.email,
        location: user.location,
        avatarUrl: user.avatarUrl,
      }}
    />
  );
}
