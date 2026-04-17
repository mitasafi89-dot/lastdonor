/**
 * Local script to trigger campaign publishing from news items.
 * Usage: npx tsx scripts/run-publish-campaigns.ts [--limit N] [--dry-run]
 *
 * Since the campaign-publisher imports Next.js server-only modules,
 * this script hits the cron API endpoint via HTTP instead.
 * Alternatively, use --dry-run to just see candidates via raw SQL.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

// Load .env.local
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

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 5;
  const dryRun = args.includes('--dry-run');

  console.log(`\n🔍 Finding unpublished news items (limit: ${limit}, dry-run: ${dryRun})...\n`);

  const candidates = await sql`
    SELECT id, title, source, category, relevance_score
    FROM news_items
    WHERE campaign_created = false AND relevance_score >= 70
    ORDER BY relevance_score DESC
    LIMIT ${limit}
  `;

  if (candidates.length === 0) {
    console.log('❌ No eligible news items found (relevance_score >= 70, campaign_created = false)');
    await sql.end();
    process.exit(0);
  }

  console.log(`Found ${candidates.length} candidates:\n`);
  for (const c of candidates) {
    console.log(`  📰 [${c.relevance_score}] ${c.category} | ${c.title}`);
    console.log(`     Source: ${c.source} | ID: ${c.id}`);
  }

  // Show recent campaign titles for context
  const recentCampaigns = await sql`
    SELECT title, subject_name, location, goal_amount, story_html, published_at
    FROM campaigns
    WHERE published_at IS NOT NULL
    ORDER BY published_at DESC
    LIMIT 15
  `;

  if (recentCampaigns.length > 0) {
    console.log(`\n📋 Recent campaign titles (last ${recentCampaigns.length}):\n`);
    for (const c of recentCampaigns) {
      const wordCount = c.story_html
        ? c.story_html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
        : 0;
      const date = c.published_at ? new Date(c.published_at).toLocaleDateString() : 'n/a';
      console.log(`  "${c.title}"`);
      console.log(`     👤 ${c.subject_name} | 📍 ${c.location} | 💰 $${((c.goal_amount ?? 0) / 100).toLocaleString()} | 📊 ${wordCount} words | 📅 ${date}`);
    }
  }

  if (dryRun) {
    console.log('\n--dry-run: skipping actual publishing.');
    await sql.end();
    process.exit(0);
  }

  // Hit the cron endpoint to actually publish
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.log('\n❌ CRON_SECRET not found in .env.local. Cannot trigger publish endpoint.');
    console.log('   Set CRON_SECRET in .env.local or run the dev server and use the admin UI.');
    await sql.end();
    process.exit(1);
  }

  console.log(`\n🚀 Triggering publish-campaigns cron at ${baseUrl}...\n`);

  try {
    const res = await fetch(`${baseUrl}/api/v1/cron/publish-campaigns`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const body = await res.json();

    if (body.ok) {
      console.log(`✅ Published ${body.data.published} campaigns out of ${body.data.qualifiedItems} candidates`);
      if (body.data.errors?.length) {
        console.log(`\n⚠️  Errors:`);
        for (const e of body.data.errors) console.log(`   ${e}`);
      }

      // Show the newly published campaigns
      const newCampaigns = await sql`
        SELECT title, slug, subject_name, location, goal_amount, story_html
        FROM campaigns
        WHERE published_at IS NOT NULL
        ORDER BY published_at DESC
        LIMIT ${body.data.published || 3}
      `;

      console.log(`\n📝 Newly published campaigns:\n`);
      for (const c of newCampaigns) {
        const wordCount = c.story_html
          ? c.story_html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
          : 0;
        console.log(`  "${c.title}"`);
        console.log(`     🔗 ${c.slug}`);
        console.log(`     👤 ${c.subject_name} | 📍 ${c.location} | 💰 $${((c.goal_amount ?? 0) / 100).toLocaleString()} | 📊 ${wordCount} words`);
        console.log();
      }
    } else {
      console.log(`❌ Failed: ${JSON.stringify(body.error)}`);
    }
  } catch (error) {
    console.log(`💥 Could not reach ${baseUrl}. Is the dev server running?`);
    console.log(`   Error: ${String(error)}`);
  }

  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
