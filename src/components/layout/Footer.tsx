import Link from 'next/link';
import { FooterDarkModeToggle } from '@/components/layout/FooterDarkModeToggle';

const LINK_GROUPS = [
  {
    title: 'Platform',
    links: [
      { label: 'Campaigns', href: '/campaigns' },
      { label: 'Completed Campaigns', href: '/completed-campaigns' },
      { label: 'How It Works', href: '/about' },
      { label: 'Share Your Story', href: '/share-your-story' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { label: 'Transparency', href: '/transparency' },
      { label: 'Rejected Campaigns', href: '/cancelled-campaigns' },
      { label: 'Editorial Standards', href: '/editorial-standards' },
      { label: 'Last Donor Wall', href: '/last-donor-wall' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
] as const;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0F1A19] text-gray-300">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div>
            <Link
              href="/"
              className="flex items-center gap-1 text-lg font-display font-bold tracking-tight text-white"
            >
              Last
              <span className="text-[#14B8A6]">Donor</span>
              <span className="text-[#FBBF24]">.</span>
            </Link>
            <p className="mt-3 text-sm text-gray-400">
              Verified fundraising for real people in crisis. 100% transparent.
              You&apos;re the reason it&apos;s done.
            </p>
            <p className="mt-4 rounded-md bg-[#14B8A6]/15 px-3 py-2 text-xs font-medium text-[#14B8A6]">
              501(c)(3) Nonprofit Organization
            </p>
          </div>

          {/* Link groups */}
          {LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-white">
                {group.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex items-center justify-between border-t border-white/10 pt-6">
          <p className="text-xs text-gray-500">
            &copy; {year} LastDonor.org. All rights reserved.
          </p>
          <FooterDarkModeToggle />
        </div>
      </div>
    </footer>
  );
}
