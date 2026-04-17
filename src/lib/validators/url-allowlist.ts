import { z } from 'zod';

/**
 * URL Allowlist Validators
 *
 * Defense in Depth: Validates that user-supplied URLs only point to
 * trusted domains. Prevents stored XSS via javascript: URIs and SSRF
 * via internal network URLs.
 */

/** Domains allowed for campaign hero/gallery images. */
const IMAGE_URL_ALLOWED_HOSTS = new Set([
  'ntnrcedafgmeyajmzvga.supabase.co',  // Our Supabase storage
  'images.unsplash.com',
  'cdn.pixabay.com',
  'images.pexels.com',
]);

/** Domains allowed for YouTube embeds. */
const YOUTUBE_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
]);

/** Blocked URL schemes */
const BLOCKED_SCHEMES = /^(javascript|data|vbscript|file|ftp):/i;

/** Blocked internal network patterns (SSRF prevention) */
const INTERNAL_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/0\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/169\.254\./,    // AWS metadata
  /^https?:\/\/\[::1\]/,       // IPv6 loopback
  /^https?:\/\/\[fd/i,         // IPv6 private
  /^https?:\/\/metadata\./i,   // Cloud metadata services
];

function isInternalUrl(url: string): boolean {
  return INTERNAL_PATTERNS.some((p) => p.test(url));
}

function isBlockedScheme(url: string): boolean {
  return BLOCKED_SCHEMES.test(url.trim());
}

/**
 * Validates a URL is HTTPS and from an allowed host.
 * Falls back to allowing any HTTPS URL if allowAnyHttps is true (for hero images
 * that may come from arbitrary news sources during automated pipeline).
 */
export function validateImageUrl(url: string, allowAnyHttps = false): boolean {
  if (isBlockedScheme(url) || isInternalUrl(url)) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (allowAnyHttps) return true;
    return IMAGE_URL_ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function validateYouTubeUrl(url: string): boolean {
  if (isBlockedScheme(url) || isInternalUrl(url)) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return YOUTUBE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Zod refinement for image URLs. Used in campaign create/update validators.
 * For automated pipeline (news images), pass allowAnyHttps = true.
 */
export const safeImageUrl = (allowAnyHttps = false) =>
  z.string().url().refine(
    (url) => validateImageUrl(url, allowAnyHttps),
    allowAnyHttps
      ? 'Image URL must use HTTPS and not point to internal networks'
      : 'Image URL must be from an allowed domain (upload via our platform)',
  );

export const safeYouTubeUrl = z.string().url().refine(
  (url) => validateYouTubeUrl(url),
  'URL must be a YouTube link using HTTPS',
);
