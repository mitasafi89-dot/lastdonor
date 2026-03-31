import { createHmac, timingSafeEqual } from 'crypto';

// ─── Config ─────────────────────────────────────────────────────────────────

const VERIFF_API_KEY = process.env.VERIFF_API_KEY!;
const VERIFF_SHARED_SECRET = process.env.VERIFF_SHARED_SECRET!;
const VERIFF_BASE_URL = process.env.VERIFF_BASE_URL || 'https://stationapi.veriff.com';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VeriffSessionRequest {
  verification: {
    callback: string;
    person: {
      firstName: string;
      lastName: string;
    };
    vendorData: string;
    timestamp: string;
  };
}

export interface VeriffSessionResponse {
  status: string;
  verification: {
    id: string;
    url: string;
    vendorData: string;
    host: string;
    status: string;
    sessionToken: string;
  };
}

export interface VeriffDecisionWebhook {
  id: string;
  attemptId: string;
  feature: string;
  code: number;
  action: string;
  vendorData: string;
  verification: {
    id: string;
    code: number;
    person: {
      firstName: string | null;
      lastName: string | null;
      dateOfBirth: string | null;
      nationality: string | null;
      yearOfBirth: string | null;
      placeOfBirth: string | null;
      pepSanctionMatch: string | null;
      idNumber: string | null;
      gender: string | null;
    };
    document: {
      number: string | null;
      type: string | null;
      country: string | null;
      validFrom: string | null;
      validUntil: string | null;
    };
    reasonCode: string | null;
    reason: string | null;
    status: 'approved' | 'declined' | 'resubmission_requested' | 'review' | 'expired' | 'abandoned';
    riskLabels: Array<{ label: string; category: string }>;
  };
  technicalData: {
    ip: string;
  };
}

// ─── Functions ──────────────────────────────────────────────────────────────

/**
 * Create a new Veriff verification session.
 */
export async function createVeriffSession(opts: {
  campaignId: string;
  campaignSlug: string;
  firstName: string;
  lastName: string;
}): Promise<VeriffSessionResponse> {
  // Veriff requires HTTPS callback URLs. In production NEXTAUTH_URL is already
  // HTTPS. In local dev, use VERIFF_CALLBACK_BASE (e.g. a Cloudflare tunnel).
  const baseUrl = process.env.VERIFF_CALLBACK_BASE || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const callbackUrl = `${baseUrl}/dashboard/campaigns/${opts.campaignSlug}/verification`;

  const payload: VeriffSessionRequest = {
    verification: {
      callback: callbackUrl,
      person: {
        firstName: opts.firstName,
        lastName: opts.lastName,
      },
      vendorData: opts.campaignId,
      timestamp: new Date().toISOString(),
    },
  };

  const body = JSON.stringify(payload);
  const signature = generateHmacSignature(body);

  const res = await fetch(`${VERIFF_BASE_URL}/v1/sessions/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AUTH-CLIENT': VERIFF_API_KEY,
      'X-HMAC-SIGNATURE': signature,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Veriff session creation failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Generate HMAC-SHA256 signature for a payload.
 */
export function generateHmacSignature(payload: string): string {
  return createHmac('sha256', VERIFF_SHARED_SECRET).update(payload).digest('hex');
}

/**
 * Validate the x-hmac-signature header on a webhook request.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function validateWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = generateHmacSignature(rawBody);
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Poll Veriff for a session decision.
 * For GET endpoints, the HMAC is computed from the session ID string.
 * Returns null if no decision is available yet.
 */
export async function getVeriffDecision(sessionId: string): Promise<VeriffDecisionWebhook | null> {
  const sig = createHmac('sha256', VERIFF_SHARED_SECRET).update(sessionId).digest('hex');

  const res = await fetch(`${VERIFF_BASE_URL}/v1/sessions/${sessionId}/decision`, {
    method: 'GET',
    headers: {
      'X-AUTH-CLIENT': VERIFF_API_KEY,
      'X-HMAC-SIGNATURE': sig,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    const text = await res.text();
    throw new Error(`Veriff decision query failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  // verification is null when decision is not yet available
  if (!data.verification) return null;

  return data as VeriffDecisionWebhook;
}
