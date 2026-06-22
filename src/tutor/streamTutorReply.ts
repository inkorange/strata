// src/tutor/streamTutorReply.ts
import type { TutorAudience } from '@/src/lib/tier'
import type { ModuleId } from '@/src/store/shellSlice'

export interface StreamTutorArgs {
  sceneSummary: string
  module: ModuleId
  tier: TutorAudience
  question: string
  /** Called with each decoded text chunk (and with any error/limit notice). */
  onChunk: (text: string) => void
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch
}

/**
 * POST the question + scene summary to /api/tutor and stream the plain-text
 * reply back through `onChunk`. Never throws — surfaces 429 / error / network
 * problems as a final chunk so the caller can render them in the message log.
 */
export async function streamTutorReply({
  sceneSummary,
  module,
  tier,
  question,
  onChunk,
  fetchImpl = fetch,
}: StreamTutorArgs): Promise<void> {
  try {
    const res = await fetchImpl('/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneSummary, module, tier, question }),
    })

    if (res.status === 429) {
      const retry = res.headers.get('retry-after')
      onChunk(
        `Rate limit reached (10 questions per minute).${retry ? ` Try again in ${retry}s.` : ''}`,
      )
      return
    }
    if (!res.ok || !res.body) {
      onChunk('[Error fetching response]')
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      onChunk(decoder.decode(value))
    }
  } catch {
    onChunk('[Network error]')
  }
}
