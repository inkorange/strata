/**
 * In-memory sliding-window rate limiter. Per Vercel Function instance: warm
 * containers share the Map; cold starts begin empty. Kills 90%+ of accidental
 * abuse at zero infra cost. Promote to KV/Upstash if it ever becomes the
 * bottleneck.
 */
interface RateLimitOptions {
  max?: number
  windowMs?: number
}
interface RateLimitResult {
  allowed: boolean
  retryAfterSec: number
  remaining: number
}

const buckets = new Map<string, number[]>()
let lastSweep = 0

function sweep(windowMs: number, now: number) {
  if (now - lastSweep < windowMs) return
  lastSweep = now
  for (const [key, timestamps] of buckets) {
    const fresh = timestamps.filter((t) => now - t < windowMs)
    if (fresh.length === 0) buckets.delete(key)
    else if (fresh.length !== timestamps.length) buckets.set(key, fresh)
  }
}

export function rateLimit(key: string, options: RateLimitOptions = {}): RateLimitResult {
  const max = options.max ?? 10
  const windowMs = options.windowMs ?? 60_000
  const now = Date.now()
  sweep(windowMs, now)
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (timestamps.length >= max) {
    const oldest = timestamps[0] ?? now
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000))
    buckets.set(key, timestamps)
    return { allowed: false, retryAfterSec, remaining: 0 }
  }
  timestamps.push(now)
  buckets.set(key, timestamps)
  return { allowed: true, retryAfterSec: 0, remaining: max - timestamps.length }
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

/** Test-only: reset all buckets so tests don't leak state. */
export function __resetRateLimitForTests() {
  buckets.clear()
  lastSweep = 0
}
