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
  // Recent campaigns
  const camps = await sql`
    SELECT c.title, c.subject_name, c.subject_hometown, c.category, c.goal_amount,
           c.published_at, length(c.story_html) as story_len,
           (SELECT count(*) FROM campaign_seed_messages m WHERE m.campaign_id = c.id) as msg_count
    FROM campaigns c
    ORDER BY c.published_at DESC NULLS LAST LIMIT 15
  `;
  console.log('=== Recent Campaigns (newest first) ===');
  for (const c of camps) {
    const approxWords = Math.round(Number(c.story_len) / 5.5);
    console.log(`  [${c.category}] ${c.subject_name} (${c.subject_hometown}) ~${approxWords}w | goal=$${c.goal_amount} | msgs=${c.msg_count} | "${c.title}"`);
  }

  // Check our 12 news items
  const ourItems = await sql`
    SELECT n.title, n.campaign_created, n.campaign_id, n.category
    FROM news_items n
    WHERE n.url LIKE '%wral.com/2025/marcus%'
       OR n.url LIKE '%wsfa.com/2025/tornado%'
       OR n.url LIKE '%militarytimes.com/2025/sgt%'
       OR n.url LIKE '%fdnewyork.com/2025%'
       OR n.url LIKE '%kold.com/2025/harold%'
       OR n.url LIKE '%fox13memphis.com/2025%'
       OR n.url LIKE '%kcrg.com/2025/grace%'
       OR n.url LIKE '%11alive.com/2025/keisha%'
       OR n.url LIKE '%kgw.com/2025/mila%'
       OR n.url LIKE '%wymt.com/2025/flash%'
       OR n.url LIKE '%kron4.com/2025/nguyen%'
       OR n.url LIKE '%dailybeast.com/2025/danielle%'
    ORDER BY n.published_at DESC
  `;
  console.log('\n=== Our 12 Seeded News Items ===');
  let published = 0;
  let unpublished = 0;
  for (const n of ourItems) {
    const status = n.campaign_created ? 'PUBLISHED' : 'PENDING';
    if (n.campaign_created) published++;
    else unpublished++;
    console.log(`  ${status} [${n.category}] ${n.title}`);
  }
  console.log(`\nSummary: ${published} published, ${unpublished} pending`);

  // Total counts
  const totalCampaigns = await sql`SELECT count(*) as c FROM campaigns`;
  const totalUnused = await sql`SELECT count(*) as c FROM news_items WHERE campaign_created = false`;
  console.log(`\nTotal campaigns: ${totalCampaigns[0].c}`);
  console.log(`Total unused news items: ${totalUnused[0].c}`);

  await sql.end();
}

main().catch((e) => { console.error(e); sql.end().finally(() => process.exit(1)); });
