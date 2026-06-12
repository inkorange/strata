'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { usePrefersReducedMotion } from '@/src/lib/accessibility'
import { useStore } from '@/src/store'

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

/** Real seconds per simulated year during playback. 0.05 s/yr → ~5 s per
 *  century, matching the Atmosphere scrubber's lively-but-readable cadence. */
const SECONDS_PER_YEAR = 0.05
/** Rolling display window for the track knob, in sim-years. */
const WINDOW_YEARS = 150

export function SystemsTimeline() {
  const elapsedYears = useStore((s) => s.elapsedYears)
  const playing = useStore((s) => s.systemsPlaying)
  const toggle = useStore((s) => s.toggleSystemsPlaying)
  const tick = useStore((s) => s.tickSystems)
  const reduced = usePrefersReducedMotion()
  const isClient = useIsClient()

  // Playback loop: advance sim-years by wall-clock delta / SECONDS_PER_YEAR.
  useEffect(() => {
    if (!playing || reduced) return
    let raf = 0
    let last = performance.now()
    const stepFrame = (now: number) => {
      const dtSeconds = (now - last) / 1000
      last = now
      tick(dtSeconds / SECONDS_PER_YEAR)
      raf = requestAnimationFrame(stepFrame)
    }
    raf = requestAnimationFrame(stepFrame)
    return () => cancelAnimationFrame(raf)
  }, [playing, reduced, tick])

  const knobPct = Math.min(1, (elapsedYears % (WINDOW_YEARS + 1)) / WINDOW_YEARS) * 100

  const content = (
    <div className="pointer-events-auto fixed z-20 bottom-4 inset-x-4 sm:left-80 sm:right-4 flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#0d0a1f]/92 px-4 py-3 backdrop-blur-xl">
      <button
        type="button"
        onClick={() => toggle()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] text-white/85 hover:bg-white/[0.1]"
        aria-label={playing ? 'Pause simulation' : 'Play simulation'}
        aria-pressed={playing}
      >
        {playing ? '◼' : '▶'}
      </button>
      <div
        className="relative flex-1 h-2 rounded-full"
        style={{ background: 'linear-gradient(90deg,#1a3a5a,#7ad9aa)', opacity: 0.6 }}
        aria-hidden
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-[#7ad9aa] shadow-[0_0_10px_#7ad9aa]"
          style={{ left: `calc(${knobPct}% - 8px)` }}
        />
      </div>
      <span className="text-xs text-white/80 font-mono tabular-nums w-16 text-right">
        Year +{Math.floor(elapsedYears)}
      </span>
    </div>
  )

  if (!isClient) return null
  return createPortal(content, document.body)
}
