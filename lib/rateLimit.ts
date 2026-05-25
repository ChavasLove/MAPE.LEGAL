// Simple in-memory rate limiter for sensitive endpoints (login, password reset).
//
// Caveats:
//   - Per-process state — on Vercel serverless each invocation may hit a fresh
//     instance, so an attacker can sidestep limits by hitting cold starts. This
//     is a defence-in-depth layer, not a Cloudflare/Redis substitute.
//   - Map is capped at MAX_BUCKETS to bound memory and per-call sweep cost.
//     During an attack with rotating keys, the cap evicts the bucket whose
//     window resets soonest first — that bucket is closest to being a no-op
//     anyway, so dropping it loses the least useful state.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

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

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      // Approaching the cap — purge expired entries first (cheaper than
      // walking on every call) and only fall back to soonest-eviction if
      // the sweep alone didn't free space. With the lookup above treating
      // expired buckets as misses, leaving them in the map until pressure
      // hits costs only memory, never correctness.
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
      if (buckets.size >= MAX_BUCKETS) evictSoonest();
    }
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

function evictSoonest(): void {
  let soonestKey: string | null = null;
  let soonestAt = Infinity;
  for (const [k, b] of buckets) {
    if (b.resetAt < soonestAt) {
      soonestAt = b.resetAt;
      soonestKey = k;
    }
  }
  if (soonestKey !== null) buckets.delete(soonestKey);
}

// Resolves the originating client IP. Trust is gated on `process.env.VERCEL`
// because off Vercel EVERY relevant header is client-controlled and
// trivially forgeable — an attacker rotating `x-real-ip` or `x-forwarded-for`
// mints unlimited rate-limit buckets and the limiter becomes a no-op. On
// Vercel the edge sets `x-vercel-forwarded-for` (and `x-real-ip`) after
// stripping client-supplied values, so they're authoritative. Off Vercel
// (self-host, future migration, direct origin hit, `npm run dev`) we
// collapse into a single 'unknown' bucket — degraded but not bypassable.
//
// `x-forwarded-for` is intentionally NOT consulted: even on Vercel, clients
// can prepend entries that the edge then forwards.
export function clientIpFrom(req: Request): string {
  if (process.env.VERCEL !== '1') return 'unknown';

  const vercel = req.headers.get('x-vercel-forwarded-for');
  if (vercel) return vercel.split(',')[0].trim();

  const real = req.headers.get('x-real-ip');
  if (real?.trim()) return real.trim();

  return 'unknown';
}
