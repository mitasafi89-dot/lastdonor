import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { donations, campaigns, users, campaignUpdates, campaignMilestones } from '@/db/schema';
import { eq, desc, sql, and, or, inArray } from 'drizzle-orm';
import { centsToDollars } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { BadgeDisplay } from '@/components/user/BadgeDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MegaphoneIcon,
  HeartIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import type { UserBadge } from '@/types';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard — LastDonor.org',
  robots: { index: false },
};

async function getDashboardData(userId: string, userEmail: string) {
  // Compute stats from actual donation rows (not denormalized user fields)
  // users.campaignsSupported is inflated (incremented per donation, not per unique campaign)
  // users.totalDonated is never decremented on refund
  // Match by userId OR donorEmail to catch donations made before userId linking was fixed
  const donorMatch = or(eq(donations.userId, userId), eq(donations.donorEmail, userEmail))!;

  const [userRow] = await db
    .select({
      lastDonorCount: users.lastDonorCount,
      badges: users.badges,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [donationStats] = await db
    .select({
      totalDonated: sql<number>`COALESCE(SUM(${donations.amount}), 0)::int`,
      campaignsSupported: sql<number>`COUNT(DISTINCT ${donations.campaignId})::int`,
    })
    .from(donations)
    .where(
      and(
        donorMatch,
        eq(donations.source, 'real'),
        eq(donations.refunded, false),
      ),
    );

  // My campaigns (user-created)
  const myCampaigns = await db
    .select({
      id: campaigns.id,
      title: campaigns.title,
      slug: campaigns.slug,
      status: campaigns.status,
      goalAmount: campaigns.goalAmount,
      raisedAmount: campaigns.raisedAmount,
      donorCount: campaigns.donorCount,
      verificationStatus: campaigns.verificationStatus,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .where(eq(campaigns.creatorId, userId))
    .orderBy(desc(campaigns.createdAt));

  // Pending actions: milestones that are "reached" but need evidence
  let pendingMilestones: { campaignTitle: string; phase: number; campaignSlug: string }[] = [];
  const activeCampaignIds = myCampaigns
    .filter((c) => c.status === 'active' || c.status === 'last_donor_zone')
    .map((c) => c.id);

  if (activeCampaignIds.length > 0) {
    pendingMilestones = await db
      .select({
        campaignTitle: campaigns.title,
        phase: campaignMilestones.phase,
        campaignSlug: campaigns.slug,
      })
      .from(campaignMilestones)
      .innerJoin(campaigns, eq(campaignMilestones.campaignId, campaigns.id))
      .where(
        and(
          inArray(campaignMilestones.campaignId, activeCampaignIds),
          eq(campaignMilestones.status, 'reached'),
        ),
      );
  }

  // Campaigns needing verification
  const needsVerification = myCampaigns.filter(
    (c) =>
      (c.status === 'active' || c.status === 'last_donor_zone') &&
      (c.verificationStatus === 'unverified' || c.verificationStatus === 'info_requested'),
  );

  // Recent donations made by user (last 5)
  const recentDonations = await db
    .select({
      id: donations.id,
      amount: donations.amount,
      createdAt: donations.createdAt,
      campaignTitle: campaigns.title,
      campaignSlug: campaigns.slug,
    })
    .from(donations)
    .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
    .where(and(donorMatch, eq(donations.source, 'real'), eq(donations.refunded, false)))
    .orderBy(desc(donations.createdAt))
    .limit(5);

  // Recent campaign updates for campaigns the user donated to (non-refunded real donations only)
  const campaignIdSubquery = db
    .selectDistinct({ id: campaigns.id })
    .from(campaigns)
    .innerJoin(donations, eq(donations.campaignId, campaigns.id))
    .where(
      and(
        donorMatch,
        eq(donations.source, 'real'),
        eq(donations.refunded, false),
      ),
    );

  const recentUpdates = await db
    .select({
      id: campaignUpdates.id,
      title: campaignUpdates.title,
      createdAt: campaignUpdates.createdAt,
      campaignTitle: campaigns.title,
      campaignSlug: campaigns.slug,
    })
    .from(campaignUpdates)
    .innerJoin(campaigns, eq(campaignUpdates.campaignId, campaigns.id))
    .where(sql`${campaignUpdates.campaignId} IN (${campaignIdSubquery})`)
    .orderBy(desc(campaignUpdates.createdAt))
    .limit(5);

  return {
    user: {
      totalDonated: donationStats?.totalDonated ?? 0,
      campaignsSupported: donationStats?.campaignsSupported ?? 0,
      lastDonorCount: userRow?.lastDonorCount ?? 0,
      badges: userRow?.badges ?? [],
    },
    myCampaigns,
    recentDonations,
    recentUpdates,
    pendingMilestones,
    needsVerification,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard');

  const {
    user,
    myCampaigns,
    recentDonations,
    recentUpdates,
    pendingMilestones,
    needsVerification,
  } = await getDashboardData(session.user.id, session.user.email ?? '');
  const badges = (user.badges ?? []) as UserBadge[];
  const activeCampaigns = myCampaigns.filter(
    (c) => c.status === 'active' || c.status === 'last_donor_zone',
  );

  return (
    <>
      <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">
        Welcome back, {session.user.name ?? 'Donor'}
      </p>

      {/* Stats Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Donated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-bold text-brand-teal">
              {centsToDollars(user.totalDonated)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Campaigns Supported
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-bold text-foreground">
              {user.campaignsSupported}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Donor Wins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-bold text-brand-amber">
              {user.lastDonorCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-bold text-foreground">
              {activeCampaigns.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Actions */}
      {(pendingMilestones.length > 0 || needsVerification.length > 0) && (
        <section className="mt-6">
          <h2 className="font-display text-lg font-bold text-foreground">Action Required</h2>
          <div className="mt-3 space-y-2">
            {pendingMilestones.map((m) => (
              <Link
                key={`${m.campaignSlug}-${m.phase}`}
                href={`/dashboard/campaigns/${m.campaignSlug}/milestones`}
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
              >
                <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>{m.campaignTitle}</strong> &ndash; Phase {m.phase} milestone reached. Submit evidence to release funds.
                </span>
                <ArrowRightIcon className="ml-auto h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              </Link>
            ))}
            {needsVerification.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/campaigns/${c.id}/verification`}
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
              >
                <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>{c.title}</strong> &ndash;{' '}
                  {c.verificationStatus === 'info_requested'
                    ? 'Additional information requested for verification.'
                    : 'Complete verification to enable fund releases.'}
                </span>
                <ArrowRightIcon className="ml-auto h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/share-your-story"
          className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary hover:bg-muted/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-teal/10">
            <MegaphoneIcon className="h-5 w-5 text-brand-teal" />
          </div>
          <div>
            <p className="font-medium text-foreground">Start a Campaign</p>
            <p className="text-sm text-muted-foreground">Share your story and raise funds</p>
          </div>
        </Link>
        <Link
          href="/campaigns"
          className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary hover:bg-muted/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-amber/10">
            <MagnifyingGlassIcon className="h-5 w-5 text-brand-amber" />
          </div>
          <div>
            <p className="font-medium text-foreground">Browse Campaigns</p>
            <p className="text-sm text-muted-foreground">Discover campaigns and donate</p>
          </div>
        </Link>
        <Link
          href="/dashboard/donations"
          className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary hover:bg-muted/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
            <HeartIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="font-medium text-foreground">Donation History</p>
            <p className="text-sm text-muted-foreground">View all your past donations</p>
          </div>
        </Link>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-lg font-bold text-foreground">Earned Badges</h2>
          <div className="mt-3">
            <BadgeDisplay badges={badges} />
          </div>
        </section>
      )}

      {/* Two-column layout: Recent Donations + Campaign Updates */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent Donations */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-foreground">Recent Donations</h2>
            <Link href="/dashboard/donations" className="text-sm font-medium text-brand-teal hover:underline">
              View all
            </Link>
          </div>
          {recentDonations.length === 0 ? (
            <Card className="mt-3">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No donations yet.{' '}
                  <Link href="/campaigns" className="text-brand-teal underline">
                    Browse campaigns
                  </Link>
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-3 space-y-2">
              {recentDonations.map((d) => (
                <Card key={d.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/campaigns/${d.campaignSlug}`}
                        className="text-sm font-medium text-brand-teal hover:underline"
                      >
                        {d.campaignTitle}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold text-foreground">
                      {centsToDollars(d.amount)}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Campaign Updates */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-foreground">Campaign Updates</h2>
            <Link href="/dashboard/updates" className="text-sm font-medium text-brand-teal hover:underline">
              View all
            </Link>
          </div>
          {recentUpdates.length === 0 ? (
            <Card className="mt-3">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No updates yet. Donate to a campaign to see updates here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-3 space-y-2">
              {recentUpdates.map((upd) => (
                <Card key={upd.id}>
                  <CardContent className="py-3">
                    <p className="text-sm font-medium text-foreground">{upd.title}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <Link
                        href={`/campaigns/${upd.campaignSlug}`}
                        className="text-xs text-brand-teal hover:underline"
                      >
                        {upd.campaignTitle}
                      </Link>
                      <span className="text-xs text-muted-foreground">{formatDate(upd.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* My Campaigns Summary */}
      {myCampaigns.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-foreground">My Campaigns</h2>
            <Link href="/dashboard/campaigns" className="text-sm font-medium text-brand-teal hover:underline">
              Manage all
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {myCampaigns.slice(0, 3).map((c) => {
              const pct = c.goalAmount > 0 ? Math.min(100, Math.round((c.raisedAmount / c.goalAmount) * 100)) : 0;
              return (
                <Card key={c.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/dashboard/campaigns/${c.id}`}
                          className="text-sm font-medium text-brand-teal hover:underline"
                        >
                          {c.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant={c.status === 'active' || c.status === 'last_donor_zone' ? 'default' : 'secondary'} className="text-xs">
                            {c.status === 'last_donor_zone' ? 'Last Donor Zone' : c.status}
                          </Badge>
                          <span>{c.donorCount} donors</span>
                          <span>{centsToDollars(c.raisedAmount)} / {centsToDollars(c.goalAmount)}</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-brand-teal transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
