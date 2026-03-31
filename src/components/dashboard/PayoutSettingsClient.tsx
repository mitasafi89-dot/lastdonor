'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

// ─── Types ───────────────────────────────────────────────────────────

interface ConnectStatus {
  hasAccount: boolean;
  status: string;
  onboardedAt: string | null;
  payoutCurrency: string | null;
}

interface CampaignBalance {
  id: string;
  title: string | null;
  slug: string | null;
  status: string | null;
  goalAmount: number;
  raisedAmount: number;
  totalReleasedAmount: number;
  totalWithdrawnAmount: number;
  availableBalance: number;
}

interface Withdrawal {
  id: string;
  campaignId: string;
  amount: number;
  status: string;
  stripeTransferId: string | null;
  failureReason: string | null;
  requestedAt: string;
  processedAt: string | null;
}

interface PayoutSettingsProps {
  connectStatus: ConnectStatus;
  campaigns: CampaignBalance[];
  withdrawals: Withdrawal[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

function centsToDollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircleIcon }> = {
  not_started: { label: 'Not Started', variant: 'outline', icon: ClockIcon },
  onboarding_started: { label: 'Onboarding In Progress', variant: 'secondary', icon: ArrowPathIcon },
  pending_verification: { label: 'Pending Verification', variant: 'secondary', icon: ClockIcon },
  verified: { label: 'Verified', variant: 'default', icon: CheckCircleIcon },
  restricted: { label: 'Restricted', variant: 'destructive', icon: ExclamationTriangleIcon },
  rejected: { label: 'Rejected', variant: 'destructive', icon: ExclamationTriangleIcon },
};

const WITHDRAWAL_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  requested: { label: 'Requested', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

// ─── Component ───────────────────────────────────────────────────────

export function PayoutSettingsClient({ connectStatus, campaigns, withdrawals }: PayoutSettingsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [withdrawAmounts, setWithdrawAmounts] = useState<Record<string, string>>({});

  const handleSetupAccount = useCallback(async (country?: string) => {
    setLoading('setup');
    try {
      const res = await fetch('/api/v1/user/stripe-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(country ? { country } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to create account');
        return;
      }
      // Redirect to Stripe onboarding
      window.location.href = data.data.onboardingUrl;
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  }, []);

  const handleResumeOnboarding = useCallback(async () => {
    setLoading('onboarding');
    try {
      const res = await fetch('/api/v1/user/stripe-connect/onboarding', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to generate link');
        return;
      }
      window.location.href = data.data.onboardingUrl;
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  }, []);

  const handleOpenDashboard = useCallback(async () => {
    setLoading('dashboard');
    try {
      const res = await fetch('/api/v1/user/stripe-connect/dashboard', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to generate link');
        return;
      }
      window.open(data.data.dashboardUrl, '_blank');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  }, []);

  const handleWithdraw = useCallback(async (campaignId: string) => {
    const amountStr = withdrawAmounts[campaignId];
    const dollars = parseFloat(amountStr);
    if (!amountStr || isNaN(dollars) || dollars <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const cents = Math.round(dollars * 100);

    setLoading(`withdraw-${campaignId}`);
    try {
      const res = await fetch(`/api/v1/user-campaigns/${campaignId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cents }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Withdrawal failed');
        return;
      }
      toast.success(`Withdrawal of ${centsToDollars(cents)} initiated`);
      setWithdrawAmounts((prev) => ({ ...prev, [campaignId]: '' }));
      router.refresh();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  }, [withdrawAmounts, router]);

  const statusInfo = STATUS_CONFIG[connectStatus.status] ?? STATUS_CONFIG.not_started;
  const StatusIcon = statusInfo.icon;
  const isVerified = connectStatus.status === 'verified';

  return (
    <div className="space-y-8">
      {/* Section 1: Account Setup / Status */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-center gap-3 mb-4">
          <BanknotesIcon className="h-6 w-6 text-teal-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Payout Account
          </h2>
        </div>

        {!connectStatus.hasAccount ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Connect your bank account through Stripe to receive funds from your campaigns.
              Stripe handles identity verification, tax forms, and secure payouts.
            </p>
            <Button
              onClick={() => handleSetupAccount()}
              disabled={loading === 'setup'}
              className="bg-teal-700 hover:bg-teal-800"
            >
              {loading === 'setup' ? 'Setting up...' : 'Connect with Stripe'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={statusInfo.variant} className="gap-1.5">
                <StatusIcon className="h-3.5 w-3.5" />
                {statusInfo.label}
              </Badge>
              {connectStatus.payoutCurrency && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Currency: {connectStatus.payoutCurrency.toUpperCase()}
                </span>
              )}
            </div>

            {connectStatus.onboardedAt && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Connected since {formatDate(connectStatus.onboardedAt)}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              {(connectStatus.status === 'onboarding_started' || connectStatus.status === 'pending_verification' || connectStatus.status === 'restricted') && (
                <Button
                  variant="outline"
                  onClick={handleResumeOnboarding}
                  disabled={loading === 'onboarding'}
                >
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                  {connectStatus.status === 'restricted' ? 'Fix Account Issues' : connectStatus.status === 'pending_verification' ? 'Complete Verification' : 'Resume Onboarding'}
                </Button>
              )}

              {isVerified && (
                <Button
                  variant="outline"
                  onClick={handleOpenDashboard}
                  disabled={loading === 'dashboard'}
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
                  Stripe Dashboard
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Campaign Balances */}
      {campaigns.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Campaign Balances
          </h2>

          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="rounded-lg border border-gray-100 p-4 dark:border-gray-800"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {campaign.title ?? 'Untitled Campaign'}
                    </h3>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        Raised: <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{centsToDollars(campaign.raisedAmount)}</span>
                      </span>
                      <span>
                        Released: <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{centsToDollars(campaign.totalReleasedAmount)}</span>
                      </span>
                      <span>
                        Withdrawn: <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{centsToDollars(campaign.totalWithdrawnAmount)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Available</p>
                      <p className={cn(
                        'font-mono text-lg font-semibold',
                        campaign.availableBalance > 0
                          ? 'text-teal-700 dark:text-teal-400'
                          : 'text-gray-400 dark:text-gray-600',
                      )}>
                        {centsToDollars(campaign.availableBalance)}
                      </p>
                    </div>

                    {isVerified && campaign.availableBalance > 0 && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          max={campaign.availableBalance / 100}
                          placeholder="Amount"
                          value={withdrawAmounts[campaign.id] ?? ''}
                          onChange={(e) =>
                            setWithdrawAmounts((prev) => ({
                              ...prev,
                              [campaign.id]: e.target.value,
                            }))
                          }
                          className="w-28 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleWithdraw(campaign.id)}
                          disabled={loading === `withdraw-${campaign.id}`}
                          className="bg-teal-700 hover:bg-teal-800"
                        >
                          {loading === `withdraw-${campaign.id}` ? 'Processing...' : 'Withdraw'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Withdrawal History */}
      {withdrawals.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Withdrawal History
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="py-2 pr-4 text-left font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="py-2 pr-4 text-left font-medium text-gray-500 dark:text-gray-400">Campaign</th>
                  <th className="py-2 pr-4 text-right font-medium text-gray-500 dark:text-gray-400">Amount</th>
                  <th className="py-2 pr-4 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {withdrawals.map((w) => {
                  const campaign = campaigns.find((c) => c.id === w.campaignId);
                  const statusConfig = WITHDRAWAL_STATUS_CONFIG[w.status] ?? WITHDRAWAL_STATUS_CONFIG.requested;

                  return (
                    <tr key={w.id}>
                      <td className="py-3 pr-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                        {formatDate(w.requestedAt)}
                      </td>
                      <td className="py-3 pr-4 text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
                        {campaign?.title ?? 'Unknown'}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono font-medium text-gray-900 dark:text-gray-100">
                        {centsToDollars(w.amount)}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusConfig.className)}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-gray-500 dark:text-gray-400">
                        {w.failureReason && (
                          <span className="text-red-600 dark:text-red-400">{w.failureReason}</span>
                        )}
                        {w.stripeTransferId && !w.failureReason && (
                          <span className="font-mono">{w.stripeTransferId}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Empty state */}
      {campaigns.length === 0 && (
        <section className="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <BanknotesIcon className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            You don&apos;t have any campaigns yet. Create a campaign to start receiving funds.
          </p>
        </section>
      )}
    </div>
  );
}
