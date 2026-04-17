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
  console.log('Applying migration 0029: Rename veriff -> stripe_verification...\n');

  // Read the migration SQL
  const migrationPath = path.join(__dirname, '..', 'src', 'db', 'migrations', '0029_stripe_identity_migration.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  
  // Split by statements and execute each
  const statements = migrationSql
    .split(';')
    .map(s => s.replace(/--.*$/gm, '').trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    console.log(`  Running: ${stmt.slice(0, 80)}...`);
    try {
      await sql.unsafe(stmt);
      console.log('  OK\n');
    } catch (err) {
      console.error(`  ERROR: ${err.message}\n`);
    }
  }

  // Verify
  const cols = await sql.unsafe(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'campaigns' 
    AND (column_name LIKE '%veriff%' OR column_name LIKE '%stripe_verification%')
  `);
  console.log('Post-migration verification columns:', cols.map(c => c.column_name).join(', '));

  await sql.end();
})();
