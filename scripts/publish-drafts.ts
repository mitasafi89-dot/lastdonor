import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function main() {
  const drafts = await client`
    SELECT id, title, slug, published, published_at, created_at
    FROM blog_posts
    WHERE published = false
    ORDER BY created_at DESC
  `;

  if (drafts.length === 0) {
    console.log('No draft posts found.');
    await client.end();
    return;
  }

  console.log(`Found ${drafts.length} draft(s):\n`);
  for (const d of drafts) {
    console.log(`  "${d.title}"`);
    console.log(`  slug: ${d.slug}`);
    console.log(`  created: ${d.created_at}\n`);
  }

  // Publish all drafts
  const ids = drafts.map((d) => d.id);
  await client`
    UPDATE blog_posts
    SET published = true, published_at = now(), updated_at = now()
    WHERE id = ANY(${ids})
  `;

  console.log(`Published ${ids.length} post(s).`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
