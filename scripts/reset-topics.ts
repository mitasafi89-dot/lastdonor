import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

async function main() {
  const { db } = await import('@/db');
  const { blogTopicQueue } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  // Reset any 'generating' topics back to 'pending'
  const updated = await db
    .update(blogTopicQueue)
    .set({ status: 'pending', updatedAt: new Date() })
    .where(eq(blogTopicQueue.status, 'generating'))
    .returning({ id: blogTopicQueue.id, title: blogTopicQueue.title });

  console.log(`Reset ${updated.length} topics to pending:`);
  updated.forEach((t) => console.log(`  - ${t.title}`));

  process.exit(0);
}

main();
