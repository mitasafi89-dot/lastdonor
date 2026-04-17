/**
 * Shared test fixtures - static data used across test suites.
 */

export const VALID_CAMPAIGN_INPUT = {
  title: 'Help First Responder Mike Recover',
  slug: 'help-first-responder-mike-recover',
  category: 'first-responders' as const,
  heroImageUrl: 'https://example.com/mike.webp',
  subjectName: 'Mike Torres',
  subjectHometown: 'Austin, TX',
  storyHtml: '<p>Mike was injured in the line of duty and needs support for his recovery and family.</p>',
  goalAmount: 1_000_000, // $10,000 in cents
  impactTiers: [
    { amount: 2500, label: 'Send a care package' },
    { amount: 10000, label: 'Cover a week of bills' },
  ],
  status: 'draft' as const,
};

export const VALID_DONATION_INPUT = {
  campaignId: '00000000-0000-4000-a000-000000000001',
  amount: 5000, // $50.00
  donorName: 'Sarah Chen',
  donorEmail: 'sarah@example.com',
  donorLocation: 'Seattle, WA',
  message: 'Wishing you a speedy recovery!',
  isAnonymous: false,
  isRecurring: false,
};

export const VALID_REGISTER_INPUT = {
  email: 'newuser@example.com',
  password: 'SecurePass1',
  name: 'New User',
};

export const STRIPE_TEST_CARDS = {
  success: '4242424242424242',
  declined: '4000000000000002',
  insufficientFunds: '4000000000009995',
} as const;
