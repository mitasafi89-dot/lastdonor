import OpenAI from 'openai';

const sharedHeaders = {
  'HTTP-Referer': 'https://lastdonor.org',
  'X-Title': 'LastDonor.org',
};

export const ai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: sharedHeaders,
});

/** Second OpenRouter key to rotate on 429 rate limits */
export const aiFallbackClient = process.env.OPENROUTER_API_KEY_FALLBACK
  ? new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY_FALLBACK,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: sharedHeaders,
    })
  : null;

export const PRIMARY_MODEL = 'qwen/qwen3-coder';
export const FALLBACK_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';
export const TERTIARY_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
