'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useStore } from '@/src/store'
import { ERAS, type Era } from '../eras'

/** Returns true on the client, false during SSR — without an extra render cycle. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

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

  // isClient is true on the first client render (no extra effect cycle needed).
  const isClient = useIsClient()

  // Mount guard so the active marker doesn't mismatch on hydration.
  // Still needed for displayedEraId — store value may differ from SSR default.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const displayedEraId = mounted ? (targetEraId ?? currentEraId) : 'present'

  const content = (
    <div className="pointer-events-auto fixed z-20 bottom-4 left-4 right-20 sm:left-80 sm:right-20 flex select-none items-center gap-3 rounded-lg border border-white/[0.08] bg-[#0d0a1f]/92 px-4 py-3 backdrop-blur-xl">
      {/* Play / Stop button */}
      <button
        type="button"
        onClick={() => (playing ? stopPlaythrough() : startPlaythrough())}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] text-white/85 hover:bg-white/[0.1]"
        aria-label={playing ? 'Stop playthrough' : 'Start playthrough'}
      >
        {playing ? '◼' : '▶'}
      </button>

      {/* Timeline track + era markers */}
      <div className="relative flex-1 h-9">
        {/* Axis line */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
        {/* Era markers */}
        {ERAS.map((era) => {
          const x = eraXPosition(era)
          const isActive = era.id === displayedEraId
          return (
            // The whole marker — dot AND label, with a padded hit area — is the
            // clickable selector, so clicking the era name (not just the 3px
            // dot) jumps to that era whether or not a playthrough is running.
            <button
              key={era.id}
              type="button"
              onClick={() => setTargetEra(era.id)}
              title={`${era.name}${era.mya > 0 ? ` (${era.mya} Mya)` : era.mya === 0 ? '' : ` (+${-era.mya} Myr)`}`}
              aria-label={era.name}
              className="group pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 px-3 py-1"
              style={{ left: `${x * 100}%` }}
            >
              <span
                className={cn(
                  'block h-3 w-3 rounded-full border transition-colors',
                  isActive
                    ? 'bg-white border-white shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                    : 'bg-white/10 border-white/40 group-hover:bg-white/25',
                )}
              />
              {/* Mobile: only the active era is labelled (6 labels collide on
               * a phone); desktop shows them all. The sidebar always names the
               * current era too. */}
              <span
                className={cn(
                  'text-[10px] uppercase tracking-wider whitespace-nowrap',
                  isActive ? 'text-white' : 'text-white/70',
                  !isActive && 'hidden sm:block',
                )}
              >
                {era.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  if (!isClient) return null
  return createPortal(content, document.body)
}
