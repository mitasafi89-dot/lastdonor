/**
 * Retry a function with exponential backoff and jitter.
 *
 * Defaults: 3 retries, 500 ms base delay, retries on all errors.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: {
    maxRetries?: number;
    baseDelayMs?: number;
    shouldRetry?: (err: unknown) => boolean;
  } = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 500, shouldRetry = () => true } = opts;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxRetries || !shouldRetry(err)) {
        throw err;
      }

      // Exponential backoff with jitter: delay = baseDelay * 2^attempt * (0.5..1.5)
      const jitter = 0.5 + Math.random();
      const delayMs = baseDelayMs * Math.pow(2, attempt) * jitter;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw lastError;
}
