const fs = require('fs'), path = require('path');
const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
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
  const res = await sql.unsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE '%drizzle%' OR tablename LIKE '%migration%')");
  console.log('Migration tables:', JSON.stringify(res));
  await sql.end();
})();
