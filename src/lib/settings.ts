/**
 * Platform settings defaults and types.
 * Client-safe — no DB imports. Server-side DB operations are in settings.server.ts.
 */

// ─── Setting categories ─────────────────────────────────────────────────────

export const SETTING_CATEGORIES = [
  'donation',
  'campaign',
  'email',
  'rate_limit',
  'platform',
  'news',
  'upload',
  'simulation',
] as const;

export type SettingCategory = (typeof SETTING_CATEGORIES)[number];

// ─── Typed defaults ─────────────────────────────────────────────────────────

export interface SettingsMap {
  // Donation
  'donation.min_amount': number;
  'donation.max_amount': number;
  'donation.preset_amounts': number[];

  // Campaign
  'campaign.min_goal': number;
  'campaign.max_goal': number;
  'campaign.max_impact_tiers': number;
  'campaign.auto_publish_threshold': number;
  'campaign.max_auto_publish': number;

  // Email
  'email.sender_name': string;
  'email.noreply_address': string;
  'email.receipts_address': string;
  'email.send_donation_receipts': boolean;
  'email.send_welcome_emails': boolean;

  // Rate limit
  'rate_limit.donations': { maxRequests: number; windowMs: number };
  'rate_limit.auth': { maxRequests: number; windowMs: number };
  'rate_limit.newsletter': { maxRequests: number; windowMs: number };
  'rate_limit.default': { maxRequests: number; windowMs: number };

  // Platform
  'platform.maintenance_mode': boolean;
  'platform.site_name': string;

  // News pipeline
  'news.max_items_per_feed': number;
  'news.retention_days': number;
  'news.classify_concurrency': number;

  // Upload
  'upload.max_file_size_bytes': number;
  'upload.allowed_types': string[];

  // Simulation
  'simulation.enabled': boolean;
  'simulation.volume_multiplier': number;
  'simulation.max_concurrent': number;
  'simulation.min_cycle_minutes': number;
  'simulation.cohort_chance': number;
  'simulation.auto_complete': boolean;
  'simulation.fund_allocation_default': string;
  'simulation.realistic_timing': boolean;
  'simulation.pause_all': boolean;

  // Phase-out
  'simulation.phase_out.enabled': boolean;
  'simulation.phase_out.threshold_low': number;
  'simulation.phase_out.threshold_mid': number;
  'simulation.phase_out.threshold_high': number;
}

export type SettingKey = keyof SettingsMap;

export const SETTING_DEFAULTS: SettingsMap = {
  // Donation (values in cents)
  'donation.min_amount': 500,
  'donation.max_amount': 10_000_000,
  'donation.preset_amounts': [2500, 5000, 10000, 25000],

  // Campaign (values in cents)
  'campaign.min_goal': 100_000,
  'campaign.max_goal': 10_000_000,
  'campaign.max_impact_tiers': 10,
  'campaign.auto_publish_threshold': 70,
  'campaign.max_auto_publish': 5,

  // Email
  'email.sender_name': 'LastDonor.org',
  'email.noreply_address': 'noreply@lastdonor.org',
  'email.receipts_address': 'receipts@lastdonor.org',
  'email.send_donation_receipts': true,
  'email.send_welcome_emails': true,

  // Rate limit
  'rate_limit.donations': { maxRequests: 10, windowMs: 60_000 },
  'rate_limit.auth': { maxRequests: 10, windowMs: 60_000 },
  'rate_limit.newsletter': { maxRequests: 5, windowMs: 60_000 },
  'rate_limit.default': { maxRequests: 100, windowMs: 60_000 },

  // Platform
  'platform.maintenance_mode': false,
  'platform.site_name': 'LastDonor.org',

  // News
  'news.max_items_per_feed': 25,
  'news.retention_days': 30,
  'news.classify_concurrency': 5,

  // Upload
  'upload.max_file_size_bytes': 5 * 1024 * 1024,
  'upload.allowed_types': ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],

  // Simulation
  'simulation.enabled': false,
  'simulation.volume_multiplier': 1.0,
  'simulation.max_concurrent': 10,
  'simulation.min_cycle_minutes': 15,
  'simulation.cohort_chance': 0.15,
  'simulation.auto_complete': true,
  'simulation.fund_allocation_default': 'pool',
  'simulation.realistic_timing': true,
  'simulation.pause_all': false,

  // Phase-out
  'simulation.phase_out.enabled': false,
  'simulation.phase_out.threshold_low': 10,
  'simulation.phase_out.threshold_mid': 25,
  'simulation.phase_out.threshold_high': 50,
};

/** Metadata for rendering setting labels in the UI */
export const SETTING_META: Record<SettingKey, { label: string; description: string; category: SettingCategory; inputType: 'number' | 'text' | 'boolean' | 'json' | 'cents' }> = {
  'donation.min_amount': { label: 'Minimum Donation', description: 'Minimum donation amount in cents', category: 'donation', inputType: 'cents' },
  'donation.max_amount': { label: 'Maximum Donation', description: 'Maximum donation amount in cents', category: 'donation', inputType: 'cents' },
  'donation.preset_amounts': { label: 'Preset Amounts', description: 'Suggested donation amounts in cents (comma-separated)', category: 'donation', inputType: 'json' },

  'campaign.min_goal': { label: 'Minimum Goal', description: 'Minimum campaign goal in cents', category: 'campaign', inputType: 'cents' },
  'campaign.max_goal': { label: 'Maximum Goal', description: 'Maximum campaign goal in cents', category: 'campaign', inputType: 'cents' },
  'campaign.max_impact_tiers': { label: 'Max Impact Tiers', description: 'Maximum impact tiers per campaign', category: 'campaign', inputType: 'number' },
  'campaign.auto_publish_threshold': { label: 'Auto-Publish Threshold', description: 'Minimum relevance score (0–100) to auto-publish campaigns', category: 'campaign', inputType: 'number' },
  'campaign.max_auto_publish': { label: 'Max Auto-Publish', description: 'Maximum campaigns auto-published per cron run', category: 'campaign', inputType: 'number' },

  'email.sender_name': { label: 'Sender Name', description: 'Display name for outgoing emails', category: 'email', inputType: 'text' },
  'email.noreply_address': { label: 'No-Reply Address', description: 'Email address for transactional emails', category: 'email', inputType: 'text' },
  'email.receipts_address': { label: 'Receipts Address', description: 'Email address for donation receipts', category: 'email', inputType: 'text' },
  'email.send_donation_receipts': { label: 'Send Donation Receipts', description: 'Automatically send receipts after donations', category: 'email', inputType: 'boolean' },
  'email.send_welcome_emails': { label: 'Send Welcome Emails', description: 'Send welcome email on newsletter signup', category: 'email', inputType: 'boolean' },

  'rate_limit.donations': { label: 'Donations Rate Limit', description: 'Max requests / window for donation endpoints', category: 'rate_limit', inputType: 'json' },
  'rate_limit.auth': { label: 'Auth Rate Limit', description: 'Max requests / window for auth endpoints', category: 'rate_limit', inputType: 'json' },
  'rate_limit.newsletter': { label: 'Newsletter Rate Limit', description: 'Max requests / window for newsletter endpoints', category: 'rate_limit', inputType: 'json' },
  'rate_limit.default': { label: 'Default Rate Limit', description: 'Fallback rate limit for undefined routes', category: 'rate_limit', inputType: 'json' },

  'platform.maintenance_mode': { label: 'Maintenance Mode', description: 'Show maintenance page to non-admin visitors', category: 'platform', inputType: 'boolean' },
  'platform.site_name': { label: 'Site Name', description: 'Public site name used in titles and emails', category: 'platform', inputType: 'text' },

  'news.max_items_per_feed': { label: 'Max Items Per Feed', description: 'Maximum articles ingested per RSS feed', category: 'news', inputType: 'number' },
  'news.retention_days': { label: 'Retention Days', description: 'Days to retain low-score news items', category: 'news', inputType: 'number' },
  'news.classify_concurrency': { label: 'Classify Concurrency', description: 'Parallel AI classification jobs', category: 'news', inputType: 'number' },

  'upload.max_file_size_bytes': { label: 'Max File Size', description: 'Maximum upload size in bytes', category: 'upload', inputType: 'number' },
  'upload.allowed_types': { label: 'Allowed File Types', description: 'Permitted MIME types for uploads (comma-separated)', category: 'upload', inputType: 'json' },

  'simulation.enabled': { label: 'Simulation Enabled', description: 'Master switch for the donation simulation engine', category: 'simulation', inputType: 'boolean' },
  'simulation.volume_multiplier': { label: 'Volume Multiplier', description: 'Global donation volume scaling factor (0.0–1.0)', category: 'simulation', inputType: 'number' },
  'simulation.max_concurrent': { label: 'Max Concurrent Campaigns', description: 'Maximum simulated campaigns active simultaneously', category: 'simulation', inputType: 'number' },
  'simulation.min_cycle_minutes': { label: 'Min Cycle Interval', description: 'Minimum minutes between simulation cycles', category: 'simulation', inputType: 'number' },
  'simulation.cohort_chance': { label: 'Cohort Injection Chance', description: 'Probability (0.0–1.0) of injecting a donor cohort per cycle', category: 'simulation', inputType: 'number' },
  'simulation.auto_complete': { label: 'Auto-Complete', description: 'Automatically close campaigns when goal is met + overfund window expires', category: 'simulation', inputType: 'boolean' },
  'simulation.fund_allocation_default': { label: 'Default Fund Allocation', description: 'Default allocation strategy for new simulated campaigns (pool or located_beneficiary)', category: 'simulation', inputType: 'text' },
  'simulation.realistic_timing': { label: 'Realistic Timing', description: 'Apply time-of-day donation patterns (ET timezone)', category: 'simulation', inputType: 'boolean' },
  'simulation.pause_all': { label: 'Pause All Simulations', description: 'Globally pause all simulated campaign donation generation', category: 'simulation', inputType: 'boolean' },

  'simulation.phase_out.enabled': { label: 'Phase-Out Enabled', description: 'Automatically reduce simulation volume as real campaigns grow', category: 'simulation', inputType: 'boolean' },
  'simulation.phase_out.threshold_low': { label: 'Phase-Out Threshold (Low)', description: 'Real campaign count where volume drops to 70%', category: 'simulation', inputType: 'number' },
  'simulation.phase_out.threshold_mid': { label: 'Phase-Out Threshold (Mid)', description: 'Real campaign count where volume drops to 30%', category: 'simulation', inputType: 'number' },
  'simulation.phase_out.threshold_high': { label: 'Phase-Out Threshold (High)', description: 'Real campaign count where simulation stops entirely', category: 'simulation', inputType: 'number' },
};

/** Human-readable category labels */
export const CATEGORY_LABELS: Record<SettingCategory, string> = {
  donation: 'Donation Settings',
  campaign: 'Campaign Settings',
  email: 'Email & Notifications',
  rate_limit: 'Rate Limiting',
  platform: 'Platform',
  news: 'News Pipeline',
  upload: 'File Uploads',
  simulation: 'Simulation Engine',
};
