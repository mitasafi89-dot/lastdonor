import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });
const sql = postgres(process.env.DATABASE_URL);

async function run() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb`;
  console.log('Migration applied: preferences column added');
  await sql.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
