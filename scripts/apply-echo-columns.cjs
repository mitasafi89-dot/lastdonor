/**
 * Apply the 3 missing echo columns from migration 0027 to the campaigns table.
 * These are required by the Drizzle schema for campaign inserts.
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
  // First check what's actually missing
  const dbCols = await sql.unsafe(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'campaigns'
  `);
  const dbColSet = new Set(dbCols.map(c => c.column_name));
  
  // All columns from schema.ts that we need
  const requiredCols = [
    'seed_donation_count',
    'message_count',
    'update_count',
  ];

  const missing = requiredCols.filter(c => !dbColSet.has(c));
  
  if (missing.length === 0) {
    console.log('All echo columns already exist. Nothing to do.');
    await sql.end();
    return;
  }

  console.log('Missing columns:', missing.join(', '));
  console.log('Applying...\n');

  for (const col of missing) {
    const stmt = `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ${col} integer NOT NULL DEFAULT 0`;
    console.log(`  ${stmt}`);
    await sql.unsafe(stmt);
    console.log('  OK\n');
  }

  // Verify
  const verify = await sql.unsafe(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name IN ('seed_donation_count', 'message_count', 'update_count')
  `);
  console.log('Verified columns now exist:', verify.map(c => c.column_name).join(', '));

  await sql.end();
})();
