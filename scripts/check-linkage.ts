import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

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
  // Check news_items -> campaign linkage
  const items = await sql`
    SELECT ni.url, ni.campaign_id, ni.campaign_created
    FROM news_items ni
    WHERE ni.url LIKE '%wral.com%' OR ni.url LIKE '%al.com/news%' OR ni.url LIKE '%kdfw.com%'
       OR ni.url LIKE '%commercialappeal%' OR ni.url LIKE '%kold.com%' OR ni.url LIKE '%kgun9%'
       OR ni.url LIKE '%kcrg.com%' OR ni.url LIKE '%fox5atlanta%' OR ni.url LIKE '%kgw.com%'
       OR ni.url LIKE '%wymt.com%' OR ni.url LIKE '%mercurynews%' OR ni.url LIKE '%fox21news%'
  `;

  console.log('=== News items linkage ===');
  for (const row of items) {
    console.log(`  ${row.campaign_created ? 'USED' : 'FREE'} ${row.campaign_id ? 'HAS_LINK' : 'NO_LINK '} ${(row.url as string).slice(0, 70)}`);
  }

  // Also check by subject_name matching
  const subjectNames = [
    'Marcus Delgado', 'Derek Thompson', 'Ramon Vega', 'Patrick Callahan',
    'Harold Jennings', 'Alicia Reeves', 'David Nwosu', 'Keisha Wallace',
    'Mila Ostrowski', 'Antonio Rivera', 'Tuan Nguyen', 'Danielle Sutton',
  ];

  console.log('\n=== Campaigns by subject name ===');
  for (const name of subjectNames) {
    const rows = await sql`
      SELECT id, subject_name, status, raised_amount, goal_amount, donor_count
      FROM campaigns WHERE subject_name ILIKE ${'%' + name + '%'}
    `;
    if (rows.length === 0) {
      console.log(`  MISSING: ${name}`);
    } else {
      for (const c of rows) {
        const pct = (c.goal_amount as number) > 0 ? Math.round(((c.raised_amount as number) / (c.goal_amount as number)) * 100) : 0;
        console.log(`  FOUND: ${c.subject_name} | ${c.status} | $${((c.raised_amount as number)/100).toLocaleString()} / $${((c.goal_amount as number)/100).toLocaleString()} (${pct}%) | ${c.donor_count} donors`);
      }
    }
  }

  await sql.end();
}

main().catch(e => { console.error(e); sql.end().finally(() => process.exit(1)); });
