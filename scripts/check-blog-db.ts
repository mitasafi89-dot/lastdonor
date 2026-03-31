import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';
import { sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL!;
console.log('Connecting to:', connectionString.replace(/:[^:@]+@/, ':***@'));

const client = postgres(connectionString, {
  prepare: false,
  connect_timeout: 15,
  idle_timeout: 10,
  max: 1,
});
const db = drizzle(client, { schema });

async function check() {
  try {
    const topics = await db.select().from(schema.blogTopicQueue).limit(5);
    console.log('Topic queue count:', topics.length);
    for (const t of topics) {
      console.log(`  Topic: "${t.title}" | Status: ${t.status} | Score: ${t.priorityScore} | Keyword: ${t.primaryKeyword}`);
    }

    const posts = await db.select({ count: sql<number>`count(*)` }).from(schema.blogPosts);
    console.log('Blog posts count:', posts[0].count);
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error('Error name:', e.name);
      console.error('Error message:', e.message);
      console.error('Error stack:', e.stack);
    } else {
      console.error('Unknown error:', JSON.stringify(e));
    }
  }
  process.exit(0);
}
check();
