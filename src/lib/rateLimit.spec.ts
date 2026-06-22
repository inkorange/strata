import { afterEach, describe, expect, it } from 'vitest'
import { __resetRateLimitForTests, clientKey, rateLimit } from '@/src/lib/rateLimit'

afterEach(() => __resetRateLimitForTests())

describe('rateLimit', () => {
  it('allows up to max requests then blocks', () => {
    for (let i = 0; i < 10; i++) {
      expect(rateLimit('k', { max: 10, windowMs: 60_000 }).allowed).toBe(true)
    }
    const blocked = rateLimit('k', { max: 10, windowMs: 60_000 })
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })

  it('tracks buckets per key independently', () => {
    rateLimit('a', { max: 1 })
    expect(rateLimit('a', { max: 1 }).allowed).toBe(false)
    expect(rateLimit('b', { max: 1 }).allowed).toBe(true)
  })
})

describe('clientKey', () => {
  it('prefers the first x-forwarded-for hop', () => {
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } })
    expect(clientKey(req)).toBe('9.9.9.9')
  })
  it('falls back to unknown', () => {
    expect(clientKey(new Request('http://x'))).toBe('unknown')
  })
})
