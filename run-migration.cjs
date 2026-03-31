const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse .env.local handling Windows \r\n line endings
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const clean = line.replace(/\r$/, '').trim();
  if (!clean || clean.startsWith('#')) continue;
  const idx = clean.indexOf('=');
  if (idx === -1) continue;
  const key = clean.slice(0, idx).trim();
  const value = clean.slice(idx + 1).trim();
  process.env[key] = value;
}

console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'yes' : 'MISSING');
execSync('npx drizzle-kit migrate', { stdio: 'inherit', env: process.env });
