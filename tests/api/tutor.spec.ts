// tests/api/tutor.spec.ts
import { afterEach, describe, expect, it } from 'vitest'
import { POST, pickModel, systemPrompt } from '@/app/api/tutor/route'
import { __resetRateLimitForTests } from '@/src/lib/rateLimit'

afterEach(() => __resetRateLimitForTests())

function req(body: unknown, ip = '1.1.1.1'): Request {
  return new Request('http://localhost/api/tutor', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

describe('pickModel', () => {
  it('uses Haiku for beginner, Sonnet otherwise', () => {
    expect(pickModel('beginner')).toBe('anthropic/claude-haiku-4-5')
    expect(pickModel('standard')).toBe('anthropic/claude-sonnet-4-6')
    expect(pickModel('advanced')).toBe('anthropic/claude-sonnet-4-6')
  })
})

describe('systemPrompt', () => {
  it('mentions the module and adjusts register by tier', () => {
    expect(systemPrompt('beginner', 'tectonics')).toMatch(/Tectonics/)
    expect(systemPrompt('advanced', 'atmosphere')).toMatch(/Atmosphere/)
    expect(systemPrompt('beginner', 'systems')).not.toEqual(systemPrompt('advanced', 'systems'))
  })
})

describe('POST /api/tutor', () => {
  it('rejects an invalid payload with 400', async () => {
    const res = await POST(req({ nope: true }))
    expect(res.status).toBe(400)
  })

  it('rate-limits after 10 requests from the same IP with 429', async () => {
    for (let i = 0; i < 10; i++) {
      // invalid bodies still consume the rate-limit budget (limit is checked first)
      await POST(req({ nope: true }, '9.9.9.9'))
    }
    const res = await POST(req({ nope: true }, '9.9.9.9'))
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBeTruthy()
  })
})
