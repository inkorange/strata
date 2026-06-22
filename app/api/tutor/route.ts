// app/api/tutor/route.ts
import { streamText } from 'ai'
import { z } from 'zod'
import { clientKey, rateLimit } from '@/src/lib/rateLimit'
import type { TutorAudience } from '@/src/lib/tier'

// Default Vercel runtime (Fluid Compute / Node). streamText buffers SSE itself
// and Node resolves the Gateway cleanly without bundler quirks.
export const runtime = 'nodejs'

type TutorModule = 'tectonics' | 'atmosphere' | 'systems' | 'hub'

const PayloadSchema = z.object({
  sceneSummary: z.string().max(4000),
  module: z.enum(['tectonics', 'atmosphere', 'systems', 'hub']),
  tier: z.enum(['beginner', 'standard', 'advanced']),
  question: z.string().min(1).max(500),
})

const MODULE_LABEL: Record<TutorModule, string> = {
  tectonics: 'the Tectonics module (plate movement and continents over geologic time)',
  atmosphere: 'the Atmosphere module (the day cycle, seasons, and global wind circulation)',
  systems: 'the Earth Systems module (the carbon cycle between reservoirs)',
  hub: 'the Strata home screen',
}

export function pickModel(tier: TutorAudience): string {
  return tier === 'beginner' ? 'anthropic/claude-haiku-4-5' : 'anthropic/claude-sonnet-4-6'
}

export function systemPrompt(tier: TutorAudience, mod: TutorModule): string {
  const base = `You are a friendly, accurate earth-science tutor inside an educational 3D app called Strata.
The student is currently in ${MODULE_LABEL[mod]}. You see the current scene described as text and answer the student's question about it.
Keep responses concise (3-6 sentences). Use plain text, no Markdown.`
  if (tier === 'beginner') {
    return `${base}
This student is in middle / early high school. Use simple analogies and everyday words. Avoid jargon — say "the plates crash together" rather than "convergent boundary".`
  }
  if (tier === 'standard') {
    return `${base}
Use standard high-school / earth-science terms: convergent boundary, dew point, residence time, the Hadley cell.`
  }
  return `${base}
Use precise college-level terms: stress and strain at plate boundaries, adiabatic lapse rate, carbon flux and residence time.`
}

export async function POST(req: Request): Promise<Response> {
  // Rate-limit before any work to bound abuse + Gateway spend. 10/min/IP is
  // generous for a tutor chat but stops scripted bombing.
  const limit = rateLimit(clientKey(req), { max: 10, windowMs: 60_000 })
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': String(limit.retryAfterSec) },
    })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const parsed = PayloadSchema.safeParse(json)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Bad request', issues: parsed.error.issues }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const { sceneSummary, module: mod, tier, question } = parsed.data

  const result = streamText({
    model: pickModel(tier),
    system: systemPrompt(tier, mod),
    prompt: `${sceneSummary}\n\nStudent question: ${question}`,
  })

  return result.toTextStreamResponse()
}
