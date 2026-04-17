import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });
const sql = postgres(process.env.DATABASE_URL);

async function run() {
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS gallery_images jsonb DEFAULT '[]'::jsonb`;
  console.log('Migration applied: gallery_images column added');
  await sql.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
