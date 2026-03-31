import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

async function main() {
  const resp = await fetch('https://openrouter.ai/api/v1/auth/key', {
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
  });
  const data = await resp.json();
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

main();
