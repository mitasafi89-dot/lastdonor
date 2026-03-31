import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

async function main() {
  const resp = await fetch('https://openrouter.ai/api/v1/models');
  const data = await resp.json();
  
  // Filter for free models
  const freeModels = data.data
    .filter((m: { id: string; pricing: { prompt: string } }) => 
      m.pricing?.prompt === '0' || m.id.includes(':free')
    )
    .map((m: { id: string; context_length: number }) => ({
      id: m.id,
      ctx: m.context_length,
    }))
    .sort((a: { ctx: number }, b: { ctx: number }) => b.ctx - a.ctx);

  console.log(`Found ${freeModels.length} free models:`);
  for (const m of freeModels.slice(0, 20)) {
    console.log(`  ${m.id} (ctx: ${m.ctx})`);
  }

  process.exit(0);
}

main();
