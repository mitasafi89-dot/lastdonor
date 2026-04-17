import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

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
  const existing = await sql`SELECT title, category, subject_name FROM campaigns ORDER BY published_at DESC NULLS LAST LIMIT 20`;
  console.log('=== Existing Campaigns ===');
  for (const c of existing) console.log(`  [${c.category}] ${c.subject_name} -- "${c.title}"`);

  const newsUnused = await sql`SELECT title, source, relevance_score, category FROM news_items WHERE campaign_created = false ORDER BY relevance_score DESC NULLS LAST LIMIT 30`;
  console.log('\n=== Unused News Items ===');
  for (const n of newsUnused) console.log(`  [${n.relevance_score}] ${n.category} | ${n.source} | ${n.title}`);

  const subjectNames = await sql`SELECT DISTINCT subject_name FROM campaigns`;
  console.log('\n=== All Subject Names (dedup check) ===');
  for (const s of subjectNames) console.log(`  ${s.subject_name}`);

  await sql.end();
}

main().catch((e) => { console.error(e); sql.end().finally(() => process.exit(1)); });
