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
  // Check campaigns columns
  const cols = await sql.unsafe(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'campaigns' 
    ORDER BY ordinal_position
  `);
  console.log('=== campaigns table columns ===');
  for (const c of cols) {
    console.log(`  ${c.column_name} (${c.data_type}, nullable=${c.is_nullable})`);
  }
  
  // Check if veriff or stripe columns exist
  const veriff = cols.filter(c => c.column_name.includes('veriff') || c.column_name.includes('stripe_verification'));
  console.log('\n=== Veriff/Stripe Identity columns ===');
  console.log(veriff.length ? veriff.map(c => c.column_name).join(', ') : '(none found)');

  // Check publishable news items count
  const news = await sql.unsafe(`
    SELECT COUNT(*) as cnt FROM news_items 
    WHERE campaign_created = false AND relevance_score >= 70
  `);
  console.log(`\n=== Publishable news items: ${news[0].cnt} ===`);

  // Show the items
  const items = await sql.unsafe(`
    SELECT id, title, source, category, relevance_score, image_url
    FROM news_items 
    WHERE campaign_created = false AND relevance_score >= 70
    ORDER BY relevance_score DESC
    LIMIT 10
  `);
  for (const i of items) {
    console.log(`  [${i.relevance_score}] ${i.category} | ${i.source} | ${i.title}`);
    console.log(`       Image: ${i.image_url || '(none)'}`);
  }

  await sql.end();
})();
