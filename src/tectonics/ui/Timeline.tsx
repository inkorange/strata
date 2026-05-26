'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useStore } from '@/src/store'
import { ERAS, type Era } from '../eras'

const MIN_MYA = -50 // Future projection (rightmost on timeline)
const MAX_MYA = 250 // Pangaea (leftmost on timeline)

/**
 * Maps an era's mya value to its horizontal position on the timeline
 * (0 = left edge / Pangaea, 1 = right edge / Future).
 */
function eraXPosition(era: Era): number {
  return (MAX_MYA - era.mya) / (MAX_MYA - MIN_MYA)
}

export function Timeline() {
  const currentEraId = useStore((s) => s.currentEraId)
  const targetEraId = useStore((s) => s.targetEraId)
  const playing = useStore((s) => s.playing)
  const setTargetEra = useStore((s) => s.setTargetEra)
  const startPlaythrough = useStore((s) => s.startPlaythrough)
  const stopPlaythrough = useStore((s) => s.stopPlaythrough)

  // Mount guard so the active marker doesn't mismatch on hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const displayedEraId = mounted ? (targetEraId ?? currentEraId) : 'present'

  return (
    <div className="pointer-events-auto fixed z-20 bottom-4 inset-x-4 sm:left-80 sm:right-4 flex items-center gap-3 rounded-lg border border-border/40 bg-card/85 px-4 py-3 backdrop-blur">
      {/* Play / Stop button */}
      <button
        type="button"
        onClick={() => (playing ? stopPlaythrough() : startPlaythrough())}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card text-foreground hover:bg-foreground/10"
        aria-label={playing ? 'Stop playthrough' : 'Start playthrough'}
      >
        {playing ? '◼' : '▶'}
      </button>

      {/* Timeline track + era markers */}
      <div className="relative flex-1 h-9">
        {/* Axis line */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border/60" />
        {/* Era markers */}
        {ERAS.map((era) => {
          const x = eraXPosition(era)
          const isActive = era.id === displayedEraId
          return (
            <div
              key={era.id}
              className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
              style={{ left: `${x * 100}%` }}
            >
              <button
                type="button"
                onClick={() => setTargetEra(era.id)}
                title={`${era.name}${era.mya > 0 ? ` (${era.mya} Mya)` : era.mya === 0 ? '' : ` (+${-era.mya} Myr)`}`}
                aria-label={era.name}
                className="pointer-events-auto block h-3 w-3"
              >
                <span
                  className={cn(
                    'pointer-events-none block h-3 w-3 rounded-full border',
                    isActive
                      ? 'bg-foreground border-foreground shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                      : 'bg-card border-foreground/60 hover:bg-foreground/20',
                  )}
                />
              </button>
              <span className="pointer-events-none text-[10px] uppercase tracking-wider text-foreground/70 whitespace-nowrap">
                {era.name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
