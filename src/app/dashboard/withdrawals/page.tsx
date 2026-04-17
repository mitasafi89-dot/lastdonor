import { redirect } from 'next/navigation';

/**
 * Legacy route: redirects to unified /dashboard/finances/payouts.
 * Preserves backward compatibility for bookmarks, emails, and notification links.
 */
export default function WithdrawalsRedirect() {
  redirect('/dashboard/finances/payouts');
}
