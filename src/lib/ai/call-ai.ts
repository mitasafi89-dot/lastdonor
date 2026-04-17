import { ai, aiFallbackClient, PRIMARY_MODEL, FALLBACK_MODEL, TERTIARY_MODEL } from './openrouter';
import { logAIUsage } from '@/lib/monitoring/ai-cost-tracker';
import { pipelineLog, pipelineError } from '@/lib/server-logger';

// ─── Global Rate Limit Tracking ────────────────────────────────────────────
// Tracks last successful call timestamp to avoid blind delays.
// Also tracks models exhausted for the day to skip them entirely.
let lastFreeCallMs = 0;
const FREE_CALL_COOLDOWN_MS = 6_000; // 6s between free-tier calls (vs old 12s before every attempt)
const dailyExhaustedModels = new Set<string>();

/**
 * Wait only the minimum time needed since the last free-tier call.
 * If enough time has passed, returns immediately.
 */
async function throttleFreeCall(): Promise<void> {
  const elapsed = Date.now() - lastFreeCallMs;
  if (elapsed < FREE_CALL_COOLDOWN_MS) {
    const waitMs = FREE_CALL_COOLDOWN_MS - elapsed;
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

export async function callAI<T>(opts: {
  systemPrompt: string;
  userPrompt: string;
  parseJson?: boolean;
  maxTokens?: number;
  promptType?: string;
  campaignId?: string;
}): Promise<T> {
  const {
    systemPrompt,
    userPrompt,
    parseJson = true,
    maxTokens = 4096,
    promptType = 'unknown',
    campaignId,
  } = opts;

  const messages: { role: 'system' | 'user'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let response: string | null = null;
  let modelUsed: string = PRIMARY_MODEL;
  let inputTokens = 0;
  let outputTokens = 0;
  const startMs = Date.now();

  // Build list of (client, model) pairs to try.
  // Strategy: try each model with primary key, then fallback key, then next model.
  // Skip models known to be exhausted for the day.
  const clients = [ai, ...(aiFallbackClient ? [aiFallbackClient] : [])];
  const modelOrder = [PRIMARY_MODEL, FALLBACK_MODEL, TERTIARY_MODEL];
  const attempts: { client: typeof ai; model: string }[] = [];
  for (const model of modelOrder) {
    if (dailyExhaustedModels.has(model)) continue;
    for (const client of clients) {
      attempts.push({ client, model });
    }
  }

  // Always add openrouter/free as a last resort (meta-router selects any available free model)
  if (!dailyExhaustedModels.has('openrouter/free')) {
    for (const client of clients) {
      attempts.push({ client, model: 'openrouter/free' });
    }
  }

  let lastError: Error | null = null;
  const reasoningExhaustedModels = new Set<string>(); // Track models that consumed all tokens on reasoning

  for (let i = 0; i < attempts.length; i++) {
    const { client, model } = attempts[i];

    // Skip if this model got daily-exhausted during this loop
    if (dailyExhaustedModels.has(model) && model !== 'openrouter/free') continue;

    try {
      // Smart throttle: only wait if not enough time since last free-tier call
      if (model.endsWith(':free')) {
        await throttleFreeCall();
      }

      // If a previous attempt on this model hit reasoning exhaustion, bump max_tokens
      const effectiveMaxTokens = reasoningExhaustedModels.has(model)
        ? Math.min(maxTokens * 4, 32768)
        : maxTokens;

      modelUsed = model;
      const completion = await client.chat.completions.create({
        model,
        messages,
        max_tokens: effectiveMaxTokens,
        temperature: 0.7,
      });

      // Mark successful call timestamp
      lastFreeCallMs = Date.now();

      inputTokens = completion.usage?.prompt_tokens ?? 0;
      outputTokens = completion.usage?.completion_tokens ?? 0;
      const choice = completion.choices[0];
      response = choice?.message?.content ?? null;

      // Reasoning models may return null content if max_tokens was exhausted on thinking
      if (!response && (choice?.message as unknown as Record<string, unknown>)?.reasoning) {
        if (!reasoningExhaustedModels.has(model)) {
          // First time - mark it and the next attempt with this model will get higher max_tokens
          reasoningExhaustedModels.add(model);
          pipelineLog('ai', `${model} spent all tokens on reasoning (${outputTokens} tokens), will retry with higher budget...`);
        } else {
          pipelineLog('ai', `${model} reasoning exhaustion persists even with ${effectiveMaxTokens} tokens, trying next...`);
        }
        continue;
      }

      // Detect truncated output (model hit max_tokens before finishing)
      const finishReason = choice?.finish_reason;
      if (response && finishReason === 'length') {
        pipelineLog('ai', `${model} output truncated (${outputTokens}/${effectiveMaxTokens} tokens, finish_reason=length), trying next...`);
        response = null;
        continue;
      }

      if (response) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const status = (error as { status?: number }).status;
      const errMsg = lastError.message;

      if (status === 429) {
        // Detect per-day exhaustion - skip ALL attempts for this model (key rotation won't help)
        if (errMsg.includes('per-day') || errMsg.includes('per day')) {
          pipelineLog('ai', `${model} hit daily limit, marking exhausted for this session`);
          dailyExhaustedModels.add(model);
        } else {
          pipelineLog('ai', `Rate limited on ${model} (key ${clients.indexOf(client) + 1}), rotating...`);
          // Brief backoff before next attempt (per-minute limits)
          await new Promise((r) => setTimeout(r, 2_000));
        }
        continue;
      }

      // Non-429 error on last attempt - throw
      if (i === attempts.length - 1) {
        logAIUsage({
          model: modelUsed,
          promptType,
          inputTokens,
          outputTokens,
          latencyMs: Date.now() - startMs,
          success: false,
          errorMessage: errMsg,
          campaignId,
        }).catch(() => {});
        throw error;
      }

      // Non-429 error but more attempts remain - try next
      pipelineLog('ai', `${model} error (${status ?? 'unknown'}): ${errMsg.slice(0, 100)}, trying next...`);
    }
  }

  if (!response) {
    const internalMsg = dailyExhaustedModels.size > 0
      ? `All free models exhausted for the day (${[...dailyExhaustedModels].join(', ')}). ${lastError?.message ?? 'No response received.'}`
      : 'AI returned empty response from all models';
    logAIUsage({
      model: modelUsed,
      promptType,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startMs,
      success: false,
      errorMessage: internalMsg,
      campaignId,
    }).catch(() => {});
    pipelineError('ai', internalMsg);
    throw new Error('AI content generation is temporarily unavailable. Please try again later.');
  }

  // Log successful usage (fire-and-forget)
  logAIUsage({
    model: modelUsed,
    promptType,
    inputTokens,
    outputTokens,
    latencyMs: Date.now() - startMs,
    success: true,
    campaignId,
  }).catch(() => {});

  if (!parseJson) {
    return response as T;
  }

  // Strip markdown code fences if present
  let cleaned = response.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  // Some models wrap JSON in extra text - extract the JSON object/array
  if (cleaned.length > 0 && cleaned[0] !== '{' && cleaned[0] !== '[') {
    const jsonStart = cleaned.search(/[\[{]/);
    if (jsonStart !== -1) {
      cleaned = cleaned.slice(jsonStart);
    }
  }

  // Trim trailing text after the JSON by finding the matching closing bracket
  if (cleaned.length > 0) {
    const openChar = cleaned[0];
    const closeChar = openChar === '{' ? '}' : openChar === '[' ? ']' : null;
    if (closeChar) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let i = 0; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\' && inString) { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === openChar) depth++;
        if (ch === closeChar) {
          depth--;
          if (depth === 0) {
            cleaned = cleaned.slice(0, i + 1);
            break;
          }
        }
      }
    }
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Failed to parse AI JSON response: ${cleaned.slice(0, 200)}`);
  }
}
