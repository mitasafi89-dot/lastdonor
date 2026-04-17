import { redirect } from 'next/navigation';

/**
 * Legacy route: redirects to /admin/payouts.
 * Preserves backward compatibility for bookmarks and links.
 */
export default function LegacyFundReleasesRedirect() {
  redirect('/admin/payouts');
}
