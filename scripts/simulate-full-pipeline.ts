/**
 * Full pipeline simulation: publish campaigns, add seed donations, messages.
 * Usage: npx tsx scripts/simulate-full-pipeline.ts
 *
 * Requires:
 *   - Dev server running on localhost (port auto-detected)
 *   - DATABASE_URL and CRON_SECRET in .env.local
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { randomBytes, randomUUID } from 'crypto';
import postgres from 'postgres';

// ─── Load .env.local ────────────────────────────────────────────────────────
const __dir = new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envContent = readFileSync(join(__dir, '..', '.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const clean = line.replace(/\r$/, '').trim();
  if (!clean || clean.startsWith('#')) continue;
  const idx = clean.indexOf('=');
  if (idx === -1) continue;
  process.env[clean.slice(0, idx).trim()] = clean.slice(idx + 1).trim();
}

const sql = postgres(process.env.DATABASE_URL!);

// ─── Helpers ────────────────────────────────────────────────────────────────

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function fakePaymentId(): string {
  const bytes = randomBytes(24);
  let id = 'pi_';
  for (let i = 0; i < 24; i++) id += ALPHA[bytes[i] % ALPHA.length];
  return id;
}

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
function fakeEmail(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
  const hex = randomBytes(3).toString('hex');
  return `${slug}${hex}@${EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)]}`;
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const DONOR_NAMES = [
  'Sarah Mitchell', 'James Rodriguez', 'Emily Chen', 'Michael Thompson',
  'Amanda Foster', 'David Kim', 'Rachel Martinez', 'Chris Anderson',
  'Jessica Lee', 'Robert Taylor', 'Maria Garcia', 'Daniel Wilson',
  'Laura Johnson', 'Kevin Brown', 'Sophia Davis', 'Andrew Clark',
  'Natalie Wright', 'Jason Patel', 'Hannah Moore', 'Brandon Scott',
  'Olivia Bennett', 'Tyler Hughes', 'Grace Walker', 'Ryan Murphy',
  'Megan Stewart', 'Joshua Reed', 'Samantha Price', 'Patrick Nelson',
  'Victoria Hill', 'Nathan Cook', 'Ashley Morgan', 'Benjamin Carter',
  'Stephanie Collins', 'Matthew Barnes', 'Jennifer Ross', 'Alexander White',
  'Katherine Young', 'William King', 'Rebecca Hall', 'Christopher Green',
];

const LOCATIONS = [
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
  'Phoenix, AZ', 'San Diego, CA', 'Dallas, TX', 'Portland, OR',
  'Denver, CO', 'Seattle, WA', 'Austin, TX', 'Nashville, TN',
  'Atlanta, GA', 'Boston, MA', 'Miami, FL', 'Minneapolis, MN',
];

const PHASES = ['first_believers', 'the_push', 'closing_in', 'last_donor_zone'] as const;

function getPhase(pct: number): typeof PHASES[number] {
  if (pct < 25) return 'first_believers';
  if (pct < 60) return 'the_push';
  if (pct < 90) return 'closing_in';
  return 'last_donor_zone';
}

// ─── Detect dev server port ─────────────────────────────────────────────────

async function findDevServer(): Promise<string> {
  for (const port of [3000, 3001, 3002, 3003]) {
    try {
      const res = await fetch(`http://localhost:${port}/api/v1/cron/publish-campaigns`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      // 401/403 means the cron route exists (auth failed = server is ours)
      if (res.status === 401 || res.status === 403 || res.ok) {
        return `http://localhost:${port}`;
      }
    } catch { /* try next */ }
  }
  throw new Error('Dev server not found on ports 3000-3003. Start it with `npm run dev`.');
}

// ─── Step 1: Publish Campaigns ──────────────────────────────────────────────

async function publishCampaigns(baseUrl: string): Promise<string[]> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new Error('CRON_SECRET not set in .env.local');

  console.log('\n' + '='.repeat(80));
  console.log('  STEP 1: Publishing 5 campaigns via AI pipeline');
  console.log('='.repeat(80));

  // Verify we have enough candidates
  const candidates = await sql`
    SELECT id, title, relevance_score, category
    FROM news_items
    WHERE campaign_created = false AND relevance_score >= 70
    ORDER BY relevance_score DESC
    LIMIT 5
  `;

  if (candidates.length < 5) {
    console.log(`\n  WARNING: Only ${candidates.length} eligible news items. Need 5.`);
    if (candidates.length === 0) {
      throw new Error('No eligible news items to publish.');
    }
  }

  console.log(`\n  Found ${candidates.length} candidates. Calling publish endpoint...\n`);

  const res = await fetch(`${baseUrl}/api/v1/cron/publish-campaigns`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(300_000), // 5 min max
  });

  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    console.log(`  ERROR: Endpoint returned non-JSON (status ${res.status}):`);
    console.log(`  ${text.slice(0, 500)}`);
    throw new Error('Publish endpoint returned invalid response');
  }

  if (!body.ok) {
    console.log(`  ERROR: ${JSON.stringify(body.error)}`);
    throw new Error('Publish endpoint failed');
  }

  console.log(`  Published: ${body.data?.published ?? 0}`);
  if (body.data?.errors?.length) {
    for (const e of body.data.errors) console.log(`  Error: ${e}`);
  }

  // Fetch newly published campaigns
  const newCampaigns = await sql`
    SELECT id, title, slug, subject_name, location, goal_amount, category,
           story_html, status, simulation_flag
    FROM campaigns
    WHERE source = 'automated' AND simulation_flag = true
      AND published_at IS NOT NULL
    ORDER BY published_at DESC
    LIMIT 5
  `;

  if (newCampaigns.length === 0) {
    throw new Error('No campaigns were created. Check logs.');
  }

  console.log(`\n  ${newCampaigns.length} campaigns ready:\n`);
  for (const c of newCampaigns) {
    const wc = c.story_html
      ? c.story_html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
      : 0;
    console.log(`  "${c.title}"`);
    console.log(`    Slug: ${c.slug}`);
    console.log(`    Subject: ${c.subject_name} | Location: ${c.location}`);
    console.log(`    Goal: $${((c.goal_amount ?? 0) / 100).toLocaleString()} | Category: ${c.category}`);
    console.log(`    Story: ${wc} words | Status: ${c.status}`);
    console.log();
  }

  return newCampaigns.map((c: any) => c.id);
}

// ─── Step 2: Seed Donations ─────────────────────────────────────────────────

interface DonationPlan {
  campaignId: string;
  fundingPct: number;  // target % of goal to fund
  donationCount: number;
  funded: boolean;      // fully funded?
}

async function seedDonations(campaignIds: string[]): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('  STEP 2: Seeding donations (some partially funded, some fully funded)');
  console.log('='.repeat(80));

  // Define funding plans: 2 fully funded, 3 partially funded at varying levels
  const plans: DonationPlan[] = [
    { campaignId: campaignIds[0], fundingPct: 105, donationCount: rand(15, 25), funded: true },
    { campaignId: campaignIds[1], fundingPct: 100, donationCount: rand(12, 20), funded: true },
    { campaignId: campaignIds[2], fundingPct: 68, donationCount: rand(8, 15), funded: false },
    ...(campaignIds[3] ? [{ campaignId: campaignIds[3], fundingPct: 35, donationCount: rand(5, 10), funded: false }] : []),
    ...(campaignIds[4] ? [{ campaignId: campaignIds[4], fundingPct: 12, donationCount: rand(3, 6), funded: false }] : []),
  ];

  for (const plan of plans) {
    const [campaign] = await sql`
      SELECT id, title, goal_amount, subject_name FROM campaigns WHERE id = ${plan.campaignId}
    `;
    if (!campaign) continue;

    const goalCents = campaign.goal_amount as number;
    const targetCents = Math.round(goalCents * plan.fundingPct / 100);
    const perDonation = Math.round(targetCents / plan.donationCount);

    console.log(`\n  Campaign: "${campaign.title}"`);
    console.log(`    Goal: $${(goalCents / 100).toLocaleString()} | Target: ${plan.fundingPct}% ($${(targetCents / 100).toLocaleString()}) | ${plan.donationCount} donations`);

    // Pick messages from seed messages pool
    const seedMessages = await sql`
      SELECT id, message FROM campaign_seed_messages
      WHERE campaign_id = ${plan.campaignId} AND used = false
      ORDER BY random()
      LIMIT ${plan.donationCount}
    `;

    let totalRaised = 0;
    const usedNames = new Set<string>();
    const donationRows: {
      id: string;
      campaign_id: string;
      stripe_payment_id: string;
      amount: number;
      donor_name: string;
      donor_email: string;
      donor_location: string | null;
      message: string | null;
      is_anonymous: boolean;
      phase_at_time: string;
      source: string;
      created_at: Date;
    }[] = [];
    const now = new Date();

    for (let i = 0; i < plan.donationCount; i++) {
      // Vary amounts: mix of small, medium, large
      let amountCents: number;
      const roll = Math.random();
      if (roll < 0.4) {
        amountCents = rand(500, 2500);   // $5-$25 small
      } else if (roll < 0.75) {
        amountCents = rand(2500, 10000); // $25-$100 medium
      } else if (roll < 0.92) {
        amountCents = rand(10000, 25000); // $100-$250 large
      } else {
        amountCents = rand(25000, 75000); // $250-$750 whale
      }

      // For the last donation of funded campaigns, hit the exact target
      if (i === plan.donationCount - 1 && plan.funded) {
        amountCents = Math.max(500, targetCents - totalRaised);
      } else {
        // Don't overshoot for non-funded campaigns
        const remaining = targetCents - totalRaised;
        if (amountCents > remaining && !plan.funded) {
          amountCents = Math.max(500, remaining);
        }
      }

      totalRaised += amountCents;
      const pct = (totalRaised / goalCents) * 100;
      const phase = getPhase(pct);

      // Pick a unique donor name
      let donorName: string;
      do { donorName = pick(DONOR_NAMES); } while (usedNames.has(donorName) && usedNames.size < DONOR_NAMES.length);
      usedNames.add(donorName);

      const isAnon = Math.random() < 0.15;
      // For the goal-crossing donation, ensure not anonymous
      const actualAnon = (plan.funded && i === plan.donationCount - 1) ? false : isAnon;

      const message = seedMessages[i]?.message ?? null;
      const createdAt = new Date(now.getTime() - (plan.donationCount - i) * rand(900_000, 7_200_000)); // spread over time

      donationRows.push({
        id: randomUUID(),
        campaign_id: plan.campaignId,
        stripe_payment_id: fakePaymentId(),
        amount: amountCents,
        donor_name: actualAnon ? 'Anonymous' : donorName,
        donor_email: fakeEmail(donorName),
        donor_location: Math.random() < 0.7 ? pick(LOCATIONS) : null,
        message,
        is_anonymous: actualAnon,
        phase_at_time: phase,
        source: 'seed',
        created_at: createdAt,
      });

      // Mark seed message as used
      if (seedMessages[i]) {
        await sql`UPDATE campaign_seed_messages SET used = true WHERE id = ${seedMessages[i].id}`;
      }
    }

    // Batch insert donations
    if (donationRows.length > 0) {
      await sql`
        INSERT INTO donations ${sql(donationRows,
          'id', 'campaign_id', 'stripe_payment_id', 'amount', 'donor_name',
          'donor_email', 'donor_location', 'message', 'is_anonymous',
          'phase_at_time', 'source', 'created_at'
        )}
      `;
    }

    // Update campaign totals
    const finalRaised = donationRows.reduce((sum, d) => sum + d.amount, 0);
    const finalDonorCount = donationRows.length;

    if (plan.funded) {
      // Mark as completed
      const lastDonor = donationRows[donationRows.length - 1];
      await sql`
        UPDATE campaigns SET
          raised_amount = ${finalRaised},
          donor_count = ${finalDonorCount},
          seed_donation_count = ${finalDonorCount},
          status = 'completed',
          completed_at = ${new Date()},
          last_donor_name = ${lastDonor.donor_name},
          last_donor_amount = ${lastDonor.amount}
        WHERE id = ${plan.campaignId}
      `;
      console.log(`    FUNDED! $${(finalRaised / 100).toLocaleString()} raised | ${finalDonorCount} donors | Last donor: ${lastDonor.donor_name}`);
    } else {
      // Partially funded - determine phase
      const pct = (finalRaised / goalCents) * 100;
      const newStatus = pct >= 90 ? 'last_donor_zone' : 'active';
      await sql`
        UPDATE campaigns SET
          raised_amount = ${finalRaised},
          donor_count = ${finalDonorCount},
          seed_donation_count = ${finalDonorCount},
          status = ${newStatus}
        WHERE id = ${plan.campaignId}
      `;
      console.log(`    ${pct.toFixed(0)}% funded | $${(finalRaised / 100).toLocaleString()} of $${(goalCents / 100).toLocaleString()} | ${finalDonorCount} donors | Status: ${newStatus}`);
    }

    // Show sample messages
    const withMessages = donationRows.filter((d): d is typeof d & { message: string } => !!d.message);
    if (withMessages.length > 0) {
      console.log(`    Messages (${withMessages.length} of ${donationRows.length}):`);
      for (const d of withMessages.slice(0, 3)) {
        const preview = d.message.length > 80 ? d.message.slice(0, 80) + '...' : d.message;
        console.log(`      - ${d.donor_name}: "${preview}"`);
      }
      if (withMessages.length > 3) console.log(`      ... and ${withMessages.length - 3} more`);
    }
  }
}

// ─── Step 3: Add Campaign Updates (comments) ────────────────────────────────

async function addCampaignUpdates(campaignIds: string[]): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('  STEP 3: Adding campaign updates/comments');
  console.log('='.repeat(80));

  for (const campaignId of campaignIds) {
    const [campaign] = await sql`
      SELECT id, title, subject_name, status, goal_amount, raised_amount, donor_count
      FROM campaigns WHERE id = ${campaignId}
    `;
    if (!campaign) continue;

    const pct = campaign.goal_amount > 0
      ? Math.round((campaign.raised_amount / campaign.goal_amount) * 100)
      : 0;
    const updateCount = campaign.status === 'completed' ? rand(2, 4) : rand(1, 2);

    const updates: Array<{
      id: string;
      campaign_id: string;
      title: string;
      body_html: string;
      update_type: string;
      created_at: Date;
    }> = [];

    const now = new Date();
    const subjectName = campaign.subject_name as string;

    // Generate appropriate updates based on campaign status
    if (campaign.status === 'completed') {
      updates.push({
        id: randomUUID(),
        campaign_id: campaignId,
        title: 'Goal Reached - Thank You!',
        body_html: `<p>We are deeply grateful to announce that this campaign for ${subjectName} has reached its goal thanks to ${campaign.donor_count} generous donors.</p><p>Every contribution, whether $5 or $500, made a real difference. The outpouring of support from this community has been truly remarkable.</p><p>We will be posting updates on how these funds are being used in the coming weeks. Thank you for being part of this.</p>`,
        update_type: 'celebration',
        created_at: new Date(now.getTime() - rand(60_000, 600_000)),
      });
      updates.push({
        id: randomUUID(),
        campaign_id: campaignId,
        title: `A Personal Thank You from ${subjectName}'s Family`,
        body_html: `<p>Our family is overwhelmed by the kindness we have received. When we started this campaign, we were not sure if anyone would listen. But you did.</p><p>To every single person who donated, shared, or simply sent a kind message, you gave us hope during one of the hardest times of our lives. We cannot express how much that means.</p><p>We will never forget this generosity.</p>`,
        update_type: 'thank_you',
        created_at: new Date(now.getTime() - rand(600_000, 3_600_000)),
      });
    }

    if (pct >= 50) {
      updates.push({
        id: randomUUID(),
        campaign_id: campaignId,
        title: 'Halfway There - Your Support is Making a Difference',
        body_html: `<p>We are thrilled to share that this campaign has reached ${pct}% of its goal! The generosity of this community continues to amaze us.</p><p>${subjectName} wanted us to share how much your support means. Every notification of a new donation brings renewed strength and hope.</p><p>If you have not had a chance to contribute yet, there is still time to make a difference. And if you have already given, please consider sharing this campaign with someone who might want to help.</p>`,
        update_type: 'milestone_reflection',
        created_at: new Date(now.getTime() - rand(3_600_000, 86_400_000)),
      });
    }

    if (pct >= 25) {
      updates.push({
        id: randomUUID(),
        campaign_id: campaignId,
        title: 'Community Response Has Been Incredible',
        body_html: `<p>We wanted to take a moment to acknowledge the incredible response from the community. ${campaign.donor_count} people have come together to support ${subjectName}, and the messages of encouragement have been just as meaningful as the financial support.</p><p>Reading through your messages has reminded us that there are so many good people in this world willing to help a stranger in need.</p>`,
        update_type: 'community_response',
        created_at: new Date(now.getTime() - rand(86_400_000, 172_800_000)),
      });
    }

    // Take only the planned number of updates, sorted by most recent
    const toInsert = updates.slice(0, updateCount);

    if (toInsert.length > 0) {
      await sql`INSERT INTO campaign_updates ${sql(toInsert, 'id', 'campaign_id', 'title', 'body_html', 'update_type', 'created_at')}`;
      await sql`UPDATE campaigns SET update_count = ${toInsert.length} WHERE id = ${campaignId}`;

      console.log(`\n  "${campaign.title}" (${campaign.status}, ${pct}% funded)`);
      for (const u of toInsert) {
        console.log(`    - [${u.update_type}] "${u.title}"`);
      }
    }
  }
}

// ─── Summary ────────────────────────────────────────────────────────────────

async function printSummary(campaignIds: string[]): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('  FINAL SUMMARY');
  console.log('='.repeat(80));

  for (const id of campaignIds) {
    const [c] = await sql`
      SELECT title, slug, subject_name, location, category, status,
             goal_amount, raised_amount, donor_count, seed_donation_count,
             message_count, update_count, story_html,
             last_donor_name, last_donor_amount, completed_at
      FROM campaigns WHERE id = ${id}
    `;
    if (!c) continue;

    const goalK = (c.goal_amount / 100).toLocaleString();
    const raisedK = (c.raised_amount / 100).toLocaleString();
    const pct = c.goal_amount > 0 ? Math.round((c.raised_amount / c.goal_amount) * 100) : 0;
    const wc = c.story_html
      ? c.story_html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
      : 0;

    const statusIcon = c.status === 'completed' ? '  FUNDED' :
                       c.status === 'last_donor_zone' ? '  LDZ' : '  ACTIVE';

    console.log(`\n  ${statusIcon} "${c.title}"`);
    console.log(`    /${c.slug}`);
    console.log(`    Subject: ${c.subject_name} | Location: ${c.location} | Category: ${c.category}`);
    console.log(`    Funding: $${raisedK} / $${goalK} (${pct}%) | ${c.donor_count} donors`);
    console.log(`    Story: ${wc} words | Updates: ${c.update_count ?? 0} | Seed messages used: ${c.seed_donation_count ?? 0}`);
    if (c.last_donor_name) {
      console.log(`    Last Donor: ${c.last_donor_name} ($${((c.last_donor_amount ?? 0) / 100).toLocaleString()})`);
    }

    // Show top 3 donor messages
    const topDonations = await sql`
      SELECT donor_name, amount, message, phase_at_time
      FROM donations
      WHERE campaign_id = ${id} AND message IS NOT NULL
      ORDER BY amount DESC
      LIMIT 3
    `;
    if (topDonations.length > 0) {
      console.log('    Top donor messages:');
      for (const d of topDonations) {
        const msg = (d.message as string).length > 70 ? (d.message as string).slice(0, 70) + '...' : d.message;
        console.log(`      $${((d.amount as number) / 100).toLocaleString()} by ${d.donor_name} (${d.phase_at_time}): "${msg}"`);
      }
    }
  }

  const totalDonations = await sql`
    SELECT COUNT(*) as cnt, SUM(amount) as total
    FROM donations
    WHERE campaign_id = ANY(${campaignIds})
  `;
  const totalUpdates = await sql`
    SELECT COUNT(*) as cnt FROM campaign_updates WHERE campaign_id = ANY(${campaignIds})
  `;

  console.log('\n' + '-'.repeat(80));
  console.log(`  TOTALS: ${campaignIds.length} campaigns | ${totalDonations[0].cnt} donations | $${((Number(totalDonations[0].total) || 0) / 100).toLocaleString()} raised | ${totalUpdates[0].cnt} updates`);
  console.log('='.repeat(80) + '\n');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n  Campaign Pipeline Simulation');
  console.log('  ============================\n');

  const baseUrl = await findDevServer();
  console.log(`  Dev server: ${baseUrl}`);

  // Step 1: Publish campaigns
  const campaignIds = await publishCampaigns(baseUrl);

  // Step 2: Seed donations
  await seedDonations(campaignIds);

  // Step 3: Add campaign updates
  await addCampaignUpdates(campaignIds);

  // Summary
  await printSummary(campaignIds);

  await sql.end();
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  sql.end().finally(() => process.exit(1));
});
