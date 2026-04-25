import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search - LastDonor.org',
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  redirect('/campaigns');
}
