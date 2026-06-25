'use client'

import { useEffect, useRef, useState } from 'react'
import { tutorTier } from '@/src/lib/tier'
import { MODULES } from '@/src/shell/modules'
import { useStore } from '@/src/store'
import { type SceneSnapshot, sceneToPrompt } from '@/src/tutor/sceneToPrompt'
import { streamTutorReply } from '@/src/tutor/streamTutorReply'
import { AssistantIcon } from './icons/AssistantIcon'

const SUGGESTED_PROMPTS: Record<string, string[]> = {
  hub: ['What can I do here?', 'Which module should I start with?'],
  tectonics: [
    'Why do mountains form?',
    'What makes earthquakes happen at a boundary?',
    'What will this look like in 10 million years?',
  ],
  atmosphere: [
    'Why do trade winds curve westward?',
    "What's the ITCZ?",
    'Why is the equator warmer than the poles?',
    'What drives the Hadley cell?',
  ],
  systems: [
    'Where does carbon go when a forest burns?',
    'How long does carbon stay in the deep ocean?',
  ],
}

/** Read exactly the fields sceneToPrompt needs out of the live store. */
function snapshot(): SceneSnapshot {
  const s = useStore.getState()
  return {
    activeModule: s.activeModule,
    currentEraId: s.currentEraId,
    targetEraId: s.targetEraId,
    season: s.season,
    hour: s.hour,
    layers: s.layers,
    scenario: s.scenario,
    fossilLever: s.fossilLever,
    landLever: s.landLever,
    elapsedYears: s.elapsedYears,
    masses: s.masses,
  }
}

export function TutorPanel() {
  const activeModule = useStore((s) => s.activeModule)
  const tierOverride = useStore((s) => s.tierOverride)
  const messages = useStore((s) => s.tutor.messages)
  const streaming = useStore((s) => s.tutor.streaming)
  const addTutorMessage = useStore((s) => s.addTutorMessage)
  const appendToLast = useStore((s) => s.appendToLast)
  const setStreaming = useStore((s) => s.setStreaming)

  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  const prompts = SUGGESTED_PROMPTS[activeModule] ?? SUGGESTED_PROMPTS.hub ?? []
  const accent = activeModule === 'hub' ? '#dffaff' : MODULES[activeModule].accentHex

  // Keep the newest token in view while streaming.
  // biome-ignore lint/correctness/useExhaustiveDependencies: depends on messages reference for streamed growth
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function ask(q: string) {
    if (!q.trim() || streaming) return
    addTutorMessage({ role: 'user', content: q, ts: Date.now() })
    addTutorMessage({ role: 'assistant', content: '', ts: Date.now() })
    setStreaming(true)
    setQuestion('')
    try {
      await streamTutorReply({
        sceneSummary: sceneToPrompt(snapshot()),
        module: activeModule,
        tier: tutorTier(tierOverride),
        question: q,
        onChunk: (chunk) => appendToLast(chunk),
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="pointer-events-auto absolute bottom-4 right-4 z-20 inline-flex h-14 w-14 items-center justify-center rounded-lg border border-white/[0.08] bg-[#0d0a1f]/92 backdrop-blur-xl transition-colors hover:bg-[#15102e]/92"
        style={{ color: accent }}
        aria-expanded={open}
        aria-label="Ask the tutor"
        title="Ask the tutor"
      >
        <AssistantIcon className="h-6 w-6" />
      </button>

      {open && (
        <aside
          className="pointer-events-auto absolute z-20 flex flex-col border border-border/40 bg-card/90 p-4 backdrop-blur
            inset-x-4 bottom-20 max-h-[60dvh] rounded-lg
            sm:right-6 sm:bottom-20 sm:left-auto sm:top-auto sm:w-80 sm:max-h-[calc(100dvh-11rem)]"
          aria-label="Tutor"
        >
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Tutor</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label="Close tutor"
            >
              Close
            </button>
          </header>

          <div ref={logRef} className="mb-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Ask about the current scene. Suggestions:
                <ul className="mt-2 space-y-2">
                  {prompts.map((p) => (
                    <li key={p}>
                      <button
                        type="button"
                        onClick={() => ask(p)}
                        disabled={streaming}
                        className="w-full rounded border border-border/40 bg-background/40 px-3 py-2 text-left text-foreground/90 hover:bg-background/70 disabled:opacity-50"
                      >
                        {p}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: messages are append-only, never reordered or removed
                  key={`${m.ts}-${i}`}
                  className={
                    m.role === 'user'
                      ? 'rounded bg-background/60 px-3 py-2 text-sm text-foreground'
                      : 'px-1 py-1 text-sm text-foreground/90'
                  }
                >
                  {m.content || (streaming ? '…' : '')}
                </div>
              ))
            )}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              ask(question)
            }}
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask…"
              disabled={streaming}
              className="flex-1 rounded border border-border/40 bg-background/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={streaming || !question.trim()}
              className="rounded bg-foreground/20 px-3 py-2 text-xs text-foreground/80 disabled:opacity-50"
            >
              {streaming ? '…' : 'Send'}
            </button>
          </form>
        </aside>
      )}
    </>
  )
}
