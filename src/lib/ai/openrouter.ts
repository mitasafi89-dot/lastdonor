import OpenAI from 'openai';

const sharedHeaders = {
  'HTTP-Referer': 'https://lastdonor.org',
  'X-Title': 'LastDonor.org',
};

let _ai: OpenAI | null = null;

function getAi(): OpenAI {
  if (!_ai) {
    _ai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: sharedHeaders,
    });
  }
  return _ai;
}

export const ai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getAi(), prop, receiver);
  },
});

/** Second OpenRouter key to rotate on 429 rate limits */
let _aiFallback: OpenAI | null | undefined = undefined;

export function getAiFallbackClient(): OpenAI | null {
  if (_aiFallback === undefined) {
    _aiFallback = process.env.OPENROUTER_API_KEY_FALLBACK
      ? new OpenAI({
          apiKey: process.env.OPENROUTER_API_KEY_FALLBACK,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: sharedHeaders,
        })
      : null;
  }
  return _aiFallback;
}

export const PRIMARY_MODEL = 'qwen/qwen3-coder';
export const FALLBACK_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';
export const TERTIARY_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
