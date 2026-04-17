/**
 * Compare Drizzle schema columns vs actual DB columns for the campaigns table.
 * Finds all columns in schema that are missing from the DB.
 */
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
  // Get actual DB columns for campaigns table
  const dbCols = await sql.unsafe(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'campaigns'
  `);
  const dbColSet = new Set(dbCols.map(c => c.column_name));
  console.log('DB columns count:', dbColSet.size);

  // Read schema.ts and extract column definitions with SQL names
  const schemaContent = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'db', 'schema.ts'), 'utf8'
  );

  // Find all column SQL names in the campaigns table definition
  // Pattern: someField: type('sql_column_name')
  const colRegex = /\w+:\s*(?:text|integer|boolean|timestamp|uuid|jsonb|real|varchar|pgEnum)\(['"]([^'"]+)['"]/g;
  
  // Find the campaigns table section roughly
  const campaignsStart = schemaContent.indexOf("export const campaigns = pgTable('campaigns'");
  const campaignsEnd = schemaContent.indexOf('export const', campaignsStart + 10);
  const campaignsSection = schemaContent.slice(campaignsStart, campaignsEnd > 0 ? campaignsEnd : undefined);
  
  const schemaColumns = [];
  let match;
  while ((match = colRegex.exec(campaignsSection)) !== null) {
    schemaColumns.push(match[1]);
  }

  console.log('Schema columns count:', schemaColumns.length);
  
  const missing = schemaColumns.filter(c => !dbColSet.has(c));
  const extra = [...dbColSet].filter(c => !schemaColumns.includes(c));
  
  console.log('\n=== Missing in DB (in schema but not in DB) ===');
  if (missing.length === 0) {
    console.log('  (none - all schema columns exist in DB)');
  } else {
    for (const col of missing) {
      console.log(`  MISSING: ${col}`);
    }
  }
  
  console.log('\n=== Extra in DB (in DB but not in schema) ===');
  if (extra.length === 0) {
    console.log('  (none)');
  } else {
    for (const col of extra) {
      console.log(`  EXTRA: ${col}`);
    }
  }

  // Also check other tables that might have issues
  for (const tableName of ['news_items', 'donations', 'users', 'audit_logs', 'blog_posts']) {
    const tCols = await sql.unsafe(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = '${tableName}'
    `);
    if (tCols.length === 0) {
      console.log(`\n[${tableName}] TABLE NOT FOUND`);
    }
  }

  await sql.end();
})();
