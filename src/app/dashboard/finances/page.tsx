import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { donations, campaigns } from '@/db/schema';
import { eq, desc, and, or } from 'drizzle-orm';
import { centsToDollars } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { PhaseBadge } from '@/components/campaign/PhaseBadge';
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
  title: 'Donation History - Finances - LastDonor.org',
  robots: { index: false },
};

export default async function DonationHistoryPage() {
  const session = (await auth())!;

  const userEmail = session.user!.email ?? '';
  const donorMatch = or(eq(donations.userId, session.user!.id!), eq(donations.donorEmail, userEmail))!;

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
        <p className="text-[14px] text-[#6B7280]">
          {donationList.length} donation{donationList.length !== 1 ? 's' : ''} totaling{' '}
          <span className="font-mono font-semibold text-[#0F766E]">{centsToDollars(totalDonated)}</span>
        </p>
      </div>

      {donationList.length === 0 ? (
        <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-white p-12 text-center dark:border-white/10 dark:bg-white/5">
          <p className="text-[14px] text-[#6B7280]">
            You haven&apos;t made any donations yet.{' '}
            <Link href="/campaigns" className="font-medium text-[#0F766E] hover:underline">
              Browse campaigns
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white dark:border-white/10 dark:bg-white/5">
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
                      className="font-medium text-[#0F766E] hover:underline"
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
                    <span className="text-[13px] capitalize text-[#6B7280]">
                      {d.campaignStatus === 'last_donor_zone' ? 'Last Donor Zone' : d.campaignStatus}
                    </span>
                  </TableCell>
                  <TableCell className="text-[13px] text-[#6B7280]">
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
