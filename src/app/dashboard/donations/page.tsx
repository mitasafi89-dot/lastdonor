import { redirect } from 'next/navigation';

/**
 * Legacy route: redirects to unified /dashboard/finances (Donation History tab).
 * Preserves backward compatibility for bookmarks, emails, and notification links.
 */
export default function DonationsRedirect() {
  redirect('/dashboard/finances');
}
