// src/tutor/streamTutorReply.spec.ts
import { describe, expect, it, vi } from 'vitest'
import { streamTutorReply } from '@/src/tutor/streamTutorReply'

function streamResponse(chunks: string[], init?: ResponseInit): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    },
  })
  return new Response(body, init)
}

const args = {
  sceneSummary: 'scene',
  module: 'tectonics' as const,
  tier: 'standard' as const,
  question: 'why?',
}

describe('streamTutorReply', () => {
  it('streams chunks to onChunk in order', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(streamResponse(['Hel', 'lo']))
    const got: string[] = []
    await streamTutorReply({ ...args, onChunk: (c) => got.push(c), fetchImpl })
    expect(got.join('')).toBe('Hello')
    const body = JSON.parse((fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string)
    expect(body).toEqual({
      sceneSummary: 'scene',
      module: 'tectonics',
      tier: 'standard',
      question: 'why?',
    })
  })

  it('emits a friendly message on 429', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 429, headers: { 'retry-after': '30' } }))
    const got: string[] = []
    await streamTutorReply({ ...args, onChunk: (c) => got.push(c), fetchImpl })
    expect(got.join('')).toMatch(/rate limit/i)
    expect(got.join('')).toMatch(/30s/)
  })

  it('emits an error note on non-ok responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 500 }))
    const got: string[] = []
    await streamTutorReply({ ...args, onChunk: (c) => got.push(c), fetchImpl })
    expect(got.join('')).toMatch(/error/i)
  })

  it('emits a network note when fetch throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('down'))
    const got: string[] = []
    await streamTutorReply({ ...args, onChunk: (c) => got.push(c), fetchImpl })
    expect(got.join('')).toMatch(/network/i)
  })
})
