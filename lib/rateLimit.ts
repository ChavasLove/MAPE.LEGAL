// Simple in-memory rate limiter for sensitive endpoints (login, password reset).
//
// Caveats:
//   - Per-process state — on Vercel serverless each invocation may hit a fresh
//     instance, so an attacker can sidestep limits by hitting cold starts. This
//     is a defence-in-depth layer, not a Cloudflare/Redis substitute.
//   - Map grows unbounded if every request uses a unique key. We sweep expired
//     entries on every check, which is O(n) — fine for login-volume traffic.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Sweep expired entries
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok:           false,
      remaining:    0,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfterSec: 0 };
}

export function clientIpFrom(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
