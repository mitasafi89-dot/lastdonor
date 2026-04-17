const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const clean = line.replace(/\r$/, '').trim();
  if (!clean || clean.startsWith('#')) continue;
  const idx = clean.indexOf('=');
  if (idx === -1) continue;
  process.env[clean.slice(0, idx).trim()] = clean.slice(idx + 1).trim();
}

const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function main() {
  // Activate the general fund campaign
  const result = await sql`
    UPDATE campaigns
    SET status = 'active',
        verification_status = 'fully_verified',
        published_at = COALESCE(published_at, NOW())
    WHERE slug = 'general-fund'
      AND status = 'draft'
  `;
  console.log('Updated rows:', result.count);

  const rows = await sql`SELECT id, title, slug, status, verification_status FROM campaigns WHERE slug = 'general-fund'`;
  console.log('General fund campaign:', JSON.stringify(rows, null, 2));
  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
