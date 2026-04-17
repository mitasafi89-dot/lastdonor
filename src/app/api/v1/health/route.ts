import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }> = {};

  // Database check
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch (err) {
    console.error('[health] Database check failed:', err instanceof Error ? err.message : err);
    checks.database = {
      status: 'error',
      latencyMs: Date.now() - dbStart,
      error: 'Database connection failed',
    };
  }

  // Stripe check
  const stripeStart = Date.now();
  try {
    await stripe.balance.retrieve();
    checks.stripe = { status: 'ok', latencyMs: Date.now() - stripeStart };
  } catch (err) {
    console.error('[health] Stripe check failed:', err instanceof Error ? err.message : err);
    checks.stripe = {
      status: 'error',
      latencyMs: Date.now() - stripeStart,
      error: 'Payment service check failed',
    };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp,
      checks,
      version: process.env.npm_package_version ?? '0.1.0',
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    },
    { status: allHealthy ? 200 : 503 },
  );
}
