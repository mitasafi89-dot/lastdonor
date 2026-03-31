import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

const ai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

async function main() {
  const models = [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'z-ai/glm-4.5-air:free',
    'stepfun/step-3.5-flash:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'arcee-ai/trinity-mini:free',
  ];
  for (const model of models) {
    console.log(`\nTesting ${model}...`);
    try {
      const r = await ai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'Return valid JSON only. No reasoning or thinking.' },
          { role: 'user', content: 'Return this JSON: {"greeting": "hello world", "count": 5}' },
        ],
        max_tokens: 200,
      });
      const choice = r.choices[0];
      const hasReasoning = !!(choice?.message as any)?.reasoning;
      console.log(`  Content: ${choice?.message?.content?.slice(0, 100)}`);
      console.log(`  Reasoning: ${hasReasoning}`);
      console.log(`  Finish: ${choice?.finish_reason}`);
      console.log(`  Tokens: in=${r.usage?.prompt_tokens} out=${r.usage?.completion_tokens}`);
    } catch (e: any) {
      console.log(`  Error: ${e.status} ${e.message?.slice(0, 150)}`);
    }
    // wait 15s between models
    await new Promise(r => setTimeout(r, 15000));
  }
  process.exit(0);
}
main();
