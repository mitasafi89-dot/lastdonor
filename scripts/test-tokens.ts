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
  // Test with a longer generation to check max tokens
  const r = await ai.chat.completions.create({
    model: 'qwen/qwen3-coder:free',
    messages: [
      { role: 'system', content: 'You are a helpful writer. Respond with valid JSON only.' },
      {
        role: 'user',
        content: `Write a content brief about "mission trip fundraising". Return as JSON:
{
  "title": "SEO optimized title",
  "metaTitle": "60 char max title",
  "metaDescription": "155 char description",
  "outline": [
    {"heading": "H2 heading", "keyPoints": ["point1", "point2"]}
  ]
}
Include at least 5 outline sections.`,
      },
    ],
    max_tokens: 4096,
  });

  const content = r.choices[0]?.message?.content ?? '';
  console.log('Finish reason:', r.choices[0]?.finish_reason);
  console.log('Output tokens:', r.usage?.completion_tokens);
  console.log('Content length:', content.length);
  console.log('Content (first 500):', content.substring(0, 500));
  console.log('Content (last 200):', content.substring(content.length - 200));
}

main().catch((e) => {
  console.error('Error:', e.message?.substring(0, 300));
  console.error('Status:', e.status);
});
