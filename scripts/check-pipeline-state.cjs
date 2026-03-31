const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const clean = line.replace(/\r$/, '').trim();
  if (!clean || clean.startsWith('#')) continue;
  const idx = clean.indexOf('=');
  if (idx === -1) continue;
  process.env[clean.slice(0, idx).trim()] = clean.slice(idx + 1).trim();
}

async function main() {
  const postgres = (await import('postgres')).default;
  const sql = postgres(process.env.DATABASE_URL);

  const topics = await sql`
    SELECT id, title, slug, primary_keyword, cause_category, priority_score, status, created_at
    FROM blog_topic_queue
    ORDER BY priority_score DESC
    LIMIT 20
  `;

  console.log(`\n=== Blog Topic Queue (${topics.length} topics) ===\n`);
  for (const t of topics) {
    console.log(`  [${t.status.toUpperCase().padEnd(10)}] Score:${String(t.priority_score).padStart(3)} | ${t.cause_category?.padEnd(16) ?? 'N/A'.padEnd(16)} | ${t.title}`);
    console.log(`                    Keyword: "${t.primary_keyword}" | Slug: ${t.slug}`);
  }

  // Check blog posts
  const posts = await sql`
    SELECT id, title, slug, source, published, seo_score, word_count, cause_category,
           primary_keyword, cover_image_url, created_at
    FROM blog_posts
    ORDER BY created_at DESC
    LIMIT 5
  `;

  console.log(`\n=== Blog Posts (${posts.length} total) ===\n`);
  for (const p of posts) {
    console.log(`  [${p.published ? 'PUBLISHED' : 'DRAFT    '}] SEO:${String(p.seo_score).padStart(3)} | Words:${String(p.word_count).padStart(5)} | ${p.title}`);
    console.log(`                    Source: ${p.source} | Category: ${p.cause_category} | Keyword: "${p.primary_keyword}"`);
    console.log(`                    Slug: ${p.slug}`);
    console.log(`                    Cover: ${p.cover_image_url ? p.cover_image_url.substring(0, 80) : 'none'}`);
  }

  // Check generation logs
  const logs = await sql`
    SELECT step, success, error_message, metadata, created_at
    FROM blog_generation_logs
    ORDER BY created_at DESC
    LIMIT 15
  `;

  console.log(`\n=== Pipeline Generation Logs (last ${logs.length}) ===\n`);
  for (const l of logs) {
    const err = l.error_message ? ` | err: ${l.error_message.substring(0, 60)}` : '';
    console.log(`  ${l.success ? 'OK' : 'FAIL'} | ${l.step.padEnd(20)} | ${l.created_at.toISOString()}${err}`);
  }

  await sql.end();
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
