import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { donations, campaigns } from '@/db/schema';
import { eq, desc, and, or } from 'drizzle-orm';
import { centsToDollars } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { PhaseBadge } from '@/components/campaign/PhaseBadge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DonationPhase } from '@/types';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Donation History — Dashboard — LastDonor.org',
  robots: { index: false },
};

export default async function DonationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard/donations');

  const userEmail = session.user.email ?? '';
  const donorMatch = or(eq(donations.userId, session.user.id), eq(donations.donorEmail, userEmail))!;

  const donationList = await db
    .select({
      id: donations.id,
      amount: donations.amount,
      phaseAtTime: donations.phaseAtTime,
      createdAt: donations.createdAt,
      campaignTitle: campaigns.title,
      campaignSlug: campaigns.slug,
      campaignStatus: campaigns.status,
    })
    .from(donations)
    .innerJoin(campaigns, eq(donations.campaignId, campaigns.id))
    .where(
      and(
        donorMatch,
        eq(donations.source, 'real'),
        eq(donations.refunded, false),
      ),
    )
    .orderBy(desc(donations.createdAt));

  const totalDonated = donationList.reduce((sum, d) => sum + d.amount, 0);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Donation History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {donationList.length} donation{donationList.length !== 1 ? 's' : ''} totaling{' '}
            <span className="font-mono font-semibold text-brand-teal">{centsToDollars(totalDonated)}</span>
          </p>
        </div>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Donate Now
        </Link>
      </div>

      {donationList.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              You haven&apos;t made any donations yet.{' '}
              <Link href="/campaigns" className="text-brand-teal underline">
                Browse campaigns
              </Link>
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {donationList.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Link
                      href={`/campaigns/${d.campaignSlug}`}
                      className="font-medium text-brand-teal hover:underline"
                    >
                      {d.campaignTitle}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {centsToDollars(d.amount)}
                  </TableCell>
                  <TableCell>
                    <PhaseBadge phase={d.phaseAtTime as DonationPhase} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-sm capitalize text-muted-foreground">
                      {d.campaignStatus === 'last_donor_zone' ? 'Last Donor Zone' : d.campaignStatus}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(d.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
