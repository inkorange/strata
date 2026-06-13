'use client'

import { useState } from 'react'
import { MODULES } from '@/src/shell/modules'
import { useStore } from '@/src/store'
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

export function TutorPanel() {
  const activeModule = useStore((s) => s.activeModule)
  const [open, setOpen] = useState(false)
  const prompts = SUGGESTED_PROMPTS[activeModule] ?? SUGGESTED_PROMPTS.hub ?? []
  const accent = activeModule === 'hub' ? '#dffaff' : MODULES[activeModule].accentHex

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
            sm:inset-y-6 sm:right-6 sm:bottom-20 sm:left-auto sm:top-auto sm:w-80 sm:max-h-none"
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
          <div className="mb-3 text-xs text-muted-foreground">
            Wired up in a later phase. Suggested prompts for this module:
          </div>
          <ul className="space-y-2 text-sm">
            {prompts.map((p) => (
              <li
                key={p}
                className="rounded border border-border/40 bg-background/40 px-3 py-2 text-foreground/90"
              >
                {p}
              </li>
            ))}
          </ul>
          <form className="mt-4 flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <input
              type="text"
              placeholder="Ask…"
              disabled
              className="flex-1 rounded border border-border/40 bg-background/40 px-3 py-2 text-sm placeholder:text-muted-foreground disabled:opacity-60"
            />
            <button
              type="submit"
              disabled
              className="rounded bg-foreground/20 px-3 py-2 text-xs text-foreground/60"
            >
              Soon
            </button>
          </form>
        </aside>
      )}
    </>
  )
}
