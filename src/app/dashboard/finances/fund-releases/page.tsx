import { redirect } from 'next/navigation';

/**
 * Legacy route: redirects to /dashboard/finances/payouts.
 * Preserves backward compatibility for bookmarks, emails, and notification links.
 */
export default function LegacyFundReleasesRedirect() {
  redirect('/dashboard/finances/payouts');
}
