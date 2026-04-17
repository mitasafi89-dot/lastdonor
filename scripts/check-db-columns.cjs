const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const clean = line.replace(/\r$/, '').trim();
  if (!clean || clean.startsWith('#')) continue;
  const idx = clean.indexOf('=');
  if (idx === -1) continue;
  process.env[clean.slice(0, idx).trim()] = clean.slice(idx + 1).trim();
}

const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function main() {
  // Check which Phase 1/2 columns exist
  const cols = await sql`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'campaigns' 
    AND column_name IN (
      'verification_notes','verification_status','paused_at','suspended_at',
      'cancelled_at','cancellation_reason','paused_reason','suspended_reason',
      'verification_reviewer_id','verification_reviewed_at',
      'total_released_amount','cancellation_notes'
    ) ORDER BY column_name
  `;
  console.log('Existing Phase1/2 columns on campaigns:', cols.map(x => x.column_name));

  // Check which Phase 1/2 tables exist
  const tables = await sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
      'verification_documents','info_requests','donor_campaign_subscriptions',
      'refund_batches','refund_records','bulk_emails','support_conversations'
    ) ORDER BY table_name
  `;
  console.log('Existing Phase1/2 tables:', tables.map(x => x.table_name));

  // Check migration journal
  const migs = await sql`
    SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5
  `;
  console.log('Last 5 migrations applied:', migs);

  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
