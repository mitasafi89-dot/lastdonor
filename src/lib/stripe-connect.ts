/**
 * Stripe Connect Express helpers
 *
 * Server-only module for creating and managing Stripe Express connected accounts,
 * generating onboarding/dashboard links, and executing transfers to creators.
 *
 * All functions enforce server-side usage only (no client imports).
 */

import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';

// ─── Platform Availability Check ─────────────────────────────────────────────

let _connectAvailable: boolean | null = null;
let _connectCheckedAt = 0;
const CONNECT_CHECK_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Probes whether Stripe Connect is enabled on the platform account.
 * Caches the result for 5 minutes to avoid redundant API calls.
 *
 * Stripe throws an error when you try to list connected accounts on a
 * platform that hasn't completed the Connect platform profile. This
 * function catches that specific error and returns false.
 */
export async function isConnectAvailable(): Promise<boolean> {
  const now = Date.now();
  if (_connectAvailable !== null && now - _connectCheckedAt < CONNECT_CHECK_TTL_MS) {
    return _connectAvailable;
  }

  try {
    await stripe.accounts.list({ limit: 1 });
    _connectAvailable = true;
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('signed up for Connect') ||
        err.message.includes('Connect platform profile') ||
        err.message.includes('not have access to the Accounts resource'))
    ) {
      _connectAvailable = false;
    } else {
      // Unexpected error (network, auth, etc.) - don't cache, assume available
      // so the real error surfaces when user attempts action.
      return true;
    }
  }

  _connectCheckedAt = now;
  return _connectAvailable;
}

// ─── Account Creation ────────────────────────────────────────────────────────

/**
 * Creates a Stripe Express connected account for a campaign creator.
 *
 * @param userId - Internal user ID (stored in Stripe metadata for webhook reconciliation)
 * @param email - Creator's email (pre-fills Stripe onboarding)
 * @param country - ISO 3166-1 alpha-2 country code (e.g. 'US', 'GB', 'DE')
 * @returns The created Stripe account object
 */
export async function createExpressAccount(
  userId: string,
  email: string,
  country?: string,
): Promise<Stripe.Account> {
  return stripe.accounts.create({
    type: 'express',
    email,
    ...(country && { country }),
    capabilities: {
      transfers: { requested: true },
    },
    metadata: {
      lastdonor_user_id: userId,
      platform: 'lastdonor',
    },
    settings: {
      payouts: {
        schedule: {
          // Express accounts use automatic payouts from Stripe to bank
          interval: 'daily',
        },
      },
    },
  });
}

// ─── Onboarding & Dashboard Links ────────────────────────────────────────────

/**
 * Creates an onboarding link for a Stripe Express account.
 * Links expire after use or approximately 24 hours.
 *
 * @param accountId - Stripe account ID (acct_xxx)
 * @param returnUrl - URL to redirect after successful onboarding
 * @param refreshUrl - URL to redirect if onboarding link expires or needs refresh
 */
export async function createOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: 'account_onboarding',
  });
  return link.url;
}

/**
 * Creates a login link to the Stripe Express Dashboard.
 * Only works for accounts that have completed onboarding.
 *
 * @param accountId - Stripe account ID (acct_xxx)
 */
export async function createDashboardLink(
  accountId: string,
): Promise<string> {
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

// ─── Account Status ──────────────────────────────────────────────────────────

export type ConnectAccountStatus =
  | 'not_started'
  | 'onboarding_started'
  | 'pending_verification'
  | 'verified'
  | 'restricted'
  | 'rejected';

export interface ConnectAccountInfo {
  status: ConnectAccountStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  defaultCurrency: string | null;
  currentlyDue: string[];
  disabledReason: string | null;
}

/**
 * Retrieves a Stripe account and maps it to our internal status model.
 *
 * Status mapping:
 *   verified    = charges_enabled AND payouts_enabled AND no currently_due requirements
 *   restricted  = has disabled_reason or past_due requirements
 *   pending_verification = has currently_due requirements but no disabled_reason
 *   rejected    = explicitly disabled with 'rejected' reason
 */
export async function getAccountStatus(
  accountId: string,
): Promise<ConnectAccountInfo> {
  const account = await stripe.accounts.retrieve(accountId);
  return mapAccountToStatus(account);
}

/**
 * Maps a Stripe Account object to our internal status model.
 * Used by both getAccountStatus() and the webhook handler.
 */
export function mapAccountToStatus(
  account: Stripe.Account,
): ConnectAccountInfo {
  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;
  const currentlyDue = account.requirements?.currently_due ?? [];
  const pastDue = account.requirements?.past_due ?? [];
  const disabledReason = account.requirements?.disabled_reason ?? null;

  let status: ConnectAccountStatus;

  if (disabledReason === 'rejected.fraud' ||
      disabledReason === 'rejected.terms_of_service' ||
      disabledReason === 'rejected.listed' ||
      disabledReason === 'rejected.other') {
    status = 'rejected';
  } else if (disabledReason || pastDue.length > 0) {
    status = 'restricted';
  } else if (chargesEnabled && payoutsEnabled && currentlyDue.length === 0) {
    status = 'verified';
  } else if (currentlyDue.length > 0) {
    status = 'pending_verification';
  } else {
    // Account exists but onboarding incomplete
    status = 'onboarding_started';
  }

  return {
    status,
    chargesEnabled,
    payoutsEnabled,
    defaultCurrency: account.default_currency ?? null,
    currentlyDue,
    disabledReason,
  };
}

// ─── Transfers ───────────────────────────────────────────────────────────────

export interface TransferResult {
  transferId: string;
  amount: number;
  currency: string;
  destination: string;
}

/**
 * Creates a transfer from the platform to a connected Express account.
 *
 * @param amount - Amount in smallest currency unit (cents for USD)
 * @param currency - Three-letter ISO currency code (e.g. 'usd')
 * @param destinationAccountId - Stripe connected account ID
 * @param metadata - Additional metadata for audit trail
 */
export async function createTransfer(
  amount: number,
  currency: string,
  destinationAccountId: string,
  metadata: Record<string, string>,
  idempotencyKey?: string,
): Promise<TransferResult> {
  const transfer = await stripe.transfers.create(
    {
      amount,
      currency,
      destination: destinationAccountId,
      metadata: {
        ...metadata,
        platform: 'lastdonor',
      },
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  );

  return {
    transferId: transfer.id,
    amount: transfer.amount,
    currency: transfer.currency,
    destination: typeof transfer.destination === 'string'
      ? transfer.destination
      : transfer.destination?.id ?? destinationAccountId,
  };
}
