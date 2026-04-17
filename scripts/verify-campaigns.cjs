/**
 * Check the most recently published campaigns and their image sources.
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
  // Get newest campaigns
  const campaigns = await sql.unsafe(`
    SELECT id, title, slug, category, hero_image_url, photo_credit, 
           subject_name, location, simulation_flag, published_at, source
    FROM campaigns 
    ORDER BY published_at DESC NULLS LAST 
    LIMIT 10
  `);

  console.log('=== Most Recent Campaigns ===\n');
  for (const c of campaigns) {
    const imageUrl = c.hero_image_url || '(none)';
    let imageSource = 'unknown';
    if (imageUrl.startsWith('/images/')) imageSource = 'fallback';
    else if (imageUrl.includes('unsplash.com')) imageSource = 'unsplash';
    else if (imageUrl.includes('pexels.com')) imageSource = 'pexels';
    else if (imageUrl.startsWith('http')) imageSource = 'news/og_meta';

    console.log(`Title:    ${c.title}`);
    console.log(`Slug:     ${c.slug}`);
    console.log(`Category: ${c.category}`);
    console.log(`Subject:  ${c.subject_name}`);
    console.log(`Location: ${c.location}`);
    console.log(`Image:    ${imageSource} -> ${imageUrl.slice(0, 100)}${imageUrl.length > 100 ? '...' : ''}`);
    console.log(`Credit:   ${c.photo_credit || '(none)'}`);
    console.log(`Source:   ${c.source}`);
    console.log(`Pub date: ${c.published_at}`);
    console.log('---');
  }

  // Also check audit logs for image source info
  const auditLogs = await sql.unsafe(`
    SELECT details FROM audit_logs 
    WHERE event_type = 'campaign.auto_published'
    ORDER BY created_at DESC 
    LIMIT 10
  `);

  console.log('\n=== Audit Logs (image source field) ===\n');
  for (const log of auditLogs) {
    const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
    console.log(`Campaign: ${d.campaignTitle || d.title || '?'}`);
    console.log(`  Image Source: ${d.imageSource || '(not recorded)'}`);
    console.log(`  Image Credit: ${d.imageCredit || '(none)'}`);
    console.log('---');
  }

  await sql.end();
})();
