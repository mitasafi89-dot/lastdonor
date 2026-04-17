/**
 * Client-side API Error Utilities
 *
 * Provides safe error extraction from API responses for use in UI components.
 * NEVER displays raw error messages from the server; always maps to user-friendly defaults.
 */

/** Safe, generic fallback messages by error context. */
const FALLBACK_MESSAGES: Record<string, string> = {
  default: 'Something went wrong. Please try again.',
  network: 'Unable to connect. Please check your connection and try again.',
  timeout: 'The request took too long. Please try again.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: 'You do not have permission to perform this action.',
  notFound: 'The requested resource was not found.',
  validation: 'Please check your input and try again.',
  rateLimit: 'Too many requests. Please wait and try again.',
};

/** Error codes that are safe to show their server-provided messages. */
const SAFE_ERROR_CODES = new Set([
  'VALIDATION_ERROR',
  'RATE_LIMITED',
  'CONFLICT',
  'NOT_FOUND',
  'CONNECT_NOT_ENABLED',
]);

/**
 * Patterns that indicate a message contains sensitive internal information.
 * If a message matches any of these, it is replaced with a generic fallback.
 */
const SENSITIVE_PATTERNS = [
  /sql|query|select\s|insert\s|update\s|delete\s/i,
  /postgres|drizzle|supabase/i,
  /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i,
  /at\s+\w+\s+\(/i, // stack trace
  /node_modules/i,
  /\.ts:|\.js:/i, // file paths with line numbers
  /internal server/i,
  /cannot read prop|undefined is not/i,
  /stripe.*error|openrouter|resend/i,
];

function isSensitive(message: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(message));
}

/**
 * Extract a safe, user-friendly error message from an API response body.
 *
 * @param body   The parsed JSON response from the API.
 * @param fallback  A context-specific fallback message (e.g., "Failed to save").
 * @returns A string safe to display in the UI.
 */
export function extractErrorMessage(
  body: { ok?: boolean; error?: { code?: string; message?: string } } | null | undefined,
  fallback: string = FALLBACK_MESSAGES.default,
): string {
  if (!body?.error) return fallback;

  const { code, message } = body.error;

  // Only pass through messages from safe error codes, and only if they don't
  // contain sensitive content (defense in depth).
  if (code && SAFE_ERROR_CODES.has(code) && message && !isSensitive(message)) {
    return message;
  }

  // For auth errors, return specific safe messages
  if (code === 'UNAUTHORIZED') return FALLBACK_MESSAGES.unauthorized;
  if (code === 'FORBIDDEN') return FALLBACK_MESSAGES.forbidden;

  // Everything else: generic fallback
  return fallback;
}

/**
 * Safely handle a fetch response and extract an error message.
 * Use this instead of `throw new Error(body.error?.message)`.
 *
 * @param res     The fetch Response object.
 * @param fallback  Context-specific fallback message.
 * @returns The error message to display, or null if the response was ok.
 */
export async function getResponseError(
  res: Response,
  fallback: string = FALLBACK_MESSAGES.default,
): Promise<string | null> {
  if (res.ok) return null;

  if (res.status === 429) return FALLBACK_MESSAGES.rateLimit;

  try {
    const body = await res.json();
    return extractErrorMessage(body, fallback);
  } catch {
    // JSON parse failed
    if (res.status === 401) return FALLBACK_MESSAGES.unauthorized;
    if (res.status === 403) return FALLBACK_MESSAGES.forbidden;
    if (res.status === 404) return FALLBACK_MESSAGES.notFound;
    return fallback;
  }
}

/**
 * Get a safe error message from a caught error.
 * NEVER displays raw error.message from unknown errors.
 */
export function getSafeErrorMessage(
  error: unknown,
  fallback: string = FALLBACK_MESSAGES.default,
): string {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return FALLBACK_MESSAGES.network;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return FALLBACK_MESSAGES.timeout;
  }
  // Never expose raw error messages
  return fallback;
}
