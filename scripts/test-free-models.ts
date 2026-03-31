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

const models = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'stepfun/step-3.5-flash:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'arcee-ai/trinity-mini:free',
  'z-ai/glm-4.5-air:free',
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'nvidia/nemotron-nano-9b-v2:free',
];

async function main() {
  for (const model of models) {
    try {
      const r = await ai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful writer. Respond with valid JSON.' },
          { role: 'user', content: 'Write a 2-sentence paragraph about fundraising. Return as JSON: {"text": "your paragraph"}' }
        ],
        max_tokens: 200,
      });
      const content = r.choices[0]?.message?.content;
      console.log(`OK  ${model} => ${content?.substring(0, 80)}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.substring(0, 80) : String(e);
      console.log(`ERR ${model} => ${msg}`);
    }
  }

  process.exit(0);
}

main();
