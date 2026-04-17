import type { CampaignCategory } from '@/types';

/**
 * Single source of truth for campaign category display metadata.
 *
 * Array ORDER determines display order in navigation menus, filter bars,
 * dropdowns, and admin UIs across the entire site.
 *
 * To add/remove/reorder categories:
 * 1. Update the DB enum via a migration (campaignCategoryEnum in schema.ts)
 * 2. Update the CampaignCategory type in src/types/index.ts
 * 3. Update this array - everything else derives from it automatically.
 */
export const CAMPAIGN_CATEGORIES = [
  {
    value: 'medical' as const,
    label: 'Medical',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  {
    value: 'memorial' as const,
    label: 'Memorial',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  },
  {
    value: 'emergency' as const,
    label: 'Emergency',
    badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  },
  {
    value: 'charity' as const,
    label: 'Charity',
    badgeClass: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  },
  {
    value: 'education' as const,
    label: 'Education',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  },
  {
    value: 'animal' as const,
    label: 'Animal',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  {
    value: 'environment' as const,
    label: 'Environment',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
  {
    value: 'business' as const,
    label: 'Business',
    badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
  },
  {
    value: 'community' as const,
    label: 'Community',
    badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  },
  {
    value: 'competition' as const,
    label: 'Competition',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  },
  {
    value: 'creative' as const,
    label: 'Creative',
    badgeClass: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  },
  {
    value: 'event' as const,
    label: 'Event',
    badgeClass: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  },
  {
    value: 'faith' as const,
    label: 'Faith',
    badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  {
    value: 'family' as const,
    label: 'Family',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  },
  {
    value: 'sports' as const,
    label: 'Sports',
    badgeClass: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300',
  },
  {
    value: 'travel' as const,
    label: 'Travel',
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  },
  {
    value: 'volunteer' as const,
    label: 'Volunteer',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  {
    value: 'wishes' as const,
    label: 'Wishes',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  },
  // Legacy categories (kept for backward compatibility with existing campaigns)
  {
    value: 'military' as const,
    label: 'Military',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
  {
    value: 'veterans' as const,
    label: 'Veterans',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  {
    value: 'first-responders' as const,
    label: 'First Responders',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  },
  {
    value: 'disaster' as const,
    label: 'Disaster Relief',
    badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  },
  {
    value: 'essential-needs' as const,
    label: 'Essential Needs',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
] as const satisfies readonly { value: CampaignCategory; label: string; badgeClass: string }[];

/** Record lookup: category value → display label. */
export const CATEGORY_LABELS: Record<CampaignCategory, string> = Object.fromEntries(
  CAMPAIGN_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<CampaignCategory, string>;

/** Record lookup: category value → Tailwind badge classes. */
export const CATEGORY_COLORS: Record<CampaignCategory, string> = Object.fromEntries(
  CAMPAIGN_CATEGORIES.map((c) => [c.value, c.badgeClass]),
) as Record<CampaignCategory, string>;
