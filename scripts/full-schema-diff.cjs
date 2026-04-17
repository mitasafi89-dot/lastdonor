/**
 * Full schema diff: compare all campaigns table columns between Drizzle schema.ts and actual DB.
 */
const fs = require('fs'), path = require('path');
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const clean = line.replace(/\r$/, '').trim();
  if (!clean || clean.startsWith('#')) continue;
  const idx = clean.indexOf('=');
  if (idx === -1) continue;
  process.env[clean.slice(0, idx).trim()] = clean.slice(idx + 1).trim();
}
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

(async () => {
  const dbCols = await sql.unsafe(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'campaigns'
    ORDER BY ordinal_position
  `);
  const dbColSet = new Set(dbCols.map(c => c.column_name));

  // Manually list all SQL column names from schema.ts campaigns table
  // Extracted from reading schema.ts lines 287-340
  const schemaCols = [
    'id', 'title', 'slug', 'status', 'hero_image_url', 'gallery_images',
    'photo_credit', 'youtube_url', 'story_html', 'goal_amount', 'raised_amount',
    'donor_count', 'category', 'location', 'subject_name', 'subject_hometown',
    'impact_tiers', 'campaign_profile', 'campaign_organizer', 'fund_usage_plan',
    'source', 'simulation_flag', 'simulation_config', 'created_at', 'updated_at',
    'published_at', 'completed_at', 'last_donor_id', 'last_donor_name',
    'last_donor_amount', 'creator_id', 'beneficiary_relation', 'verification_status',
    'cancellation_reason', 'cancellation_notes', 'cancelled_at', 'paused_at',
    'paused_reason', 'suspended_at', 'suspended_reason', 'verification_reviewer_id',
    'verification_reviewed_at', 'verification_notes', 'total_released_amount',
    'total_withdrawn_amount', 'stripe_verification_id', 'stripe_verification_url',
    'seed_donation_count', 'message_count', 'update_count',
  ];

  const schemaColSet = new Set(schemaCols);
  
  const missingInDb = schemaCols.filter(c => !dbColSet.has(c));
  const extraInDb = [...dbColSet].filter(c => !schemaColSet.has(c));

  console.log('=== Schema columns missing from DB ===');
  if (missingInDb.length === 0) console.log('  NONE - all good!');
  else for (const c of missingInDb) console.log(`  MISSING: ${c}`);

  console.log('\n=== DB columns not in schema ===');
  if (extraInDb.length === 0) console.log('  NONE');
  else for (const c of extraInDb) console.log(`  EXTRA: ${c}`);

  // Also check constraints that might conflict
  const checks = await sql.unsafe(`
    SELECT conname FROM pg_constraint 
    WHERE conrelid = 'campaigns'::regclass AND contype = 'c'
  `);
  console.log('\n=== Check constraints on campaigns ===');
  for (const c of checks) console.log(`  ${c.conname}`);

  await sql.end();
})();
