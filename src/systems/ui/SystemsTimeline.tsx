'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { usePrefersReducedMotion } from '@/src/lib/accessibility'
import { useStore } from '@/src/store'
import { MAX_YEARS } from '@/src/systems/systemsSlice'

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

/** Real seconds per simulated year during playback. 0.05 s/yr → ~10 s across
 *  the 200-year scrub range — lively but readable. */
const SECONDS_PER_YEAR = 0.05
/** Cap the per-frame sim advance so a backgrounded tab returning doesn't dump a
 *  huge dt into the integrator. */
const MAX_FRAME_SECONDS = 0.1

/**
 * Playback + scrub control for the carbon sandbox. The track is fully
 * draggable: drag the knob (or click the track) to jump to any year, and the
 * masses re-project deterministically from the scenario seed. Play advances the
 * year continuously; both paths flow through the store's setYear/tickSystems so
 * the simulation state always matches the knob position.
 */
export function SystemsTimeline() {
  const elapsedYears = useStore((s) => s.elapsedYears)
  const playing = useStore((s) => s.systemsPlaying)
  const toggle = useStore((s) => s.toggleSystemsPlaying)
  const tick = useStore((s) => s.tickSystems)
  const setYear = useStore((s) => s.setYear)
  const reduced = usePrefersReducedMotion()
  const isClient = useIsClient()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      setYear(t * MAX_YEARS)
    },
    [setYear],
  )

  // Drag handlers on window so the knob keeps following off-track.
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => setFromClientX(e.clientX)
    const onUp = () => setDragging(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, setFromClientX])

  // Playback loop: advance sim-years by wall-clock delta / SECONDS_PER_YEAR.
  useEffect(() => {
    if (!playing || reduced) return
    let raf = 0
    let last = performance.now()
    const stepFrame = (now: number) => {
      const dtSeconds = Math.min(MAX_FRAME_SECONDS, (now - last) / 1000)
      last = now
      tick(dtSeconds / SECONDS_PER_YEAR)
      raf = requestAnimationFrame(stepFrame)
    }
    raf = requestAnimationFrame(stepFrame)
    return () => cancelAnimationFrame(raf)
  }, [playing, reduced, tick])

  const knobPct = Math.max(0, Math.min(1, elapsedYears / MAX_YEARS)) * 100

  const content = (
    <div className="pointer-events-auto fixed z-20 bottom-4 left-4 right-20 sm:left-80 sm:right-20 flex select-none items-center gap-3 rounded-lg border border-white/[0.08] bg-[#0d0a1f]/92 px-4 py-3 backdrop-blur-xl">
      <button
        type="button"
        onClick={() => toggle()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] text-white/85 hover:bg-white/[0.1]"
        aria-label={playing ? 'Pause simulation' : 'Play simulation'}
        aria-pressed={playing}
      >
        {playing ? '◼' : '▶'}
      </button>
      {/* biome-ignore lint/a11y/useSemanticElements: native range input can't carry the gradient track + glow knob design; ARIA slider role is the documented fallback. */}
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          if (playing) toggle() // pause while scrubbing
          setDragging(true)
          setFromClientX(e.clientX)
        }}
        className="relative flex-1 h-2 cursor-pointer touch-none rounded-full"
        style={{ background: 'linear-gradient(90deg,#1a3a5a,#7ad9aa)', opacity: 0.6 }}
        role="slider"
        aria-label="Timeline (years)"
        aria-valuemin={0}
        aria-valuemax={MAX_YEARS}
        aria-valuenow={Math.round(elapsedYears)}
        tabIndex={0}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-[#7ad9aa] shadow-[0_0_10px_#7ad9aa]"
          style={{ left: `calc(${knobPct}% - 8px)` }}
        />
      </div>
      <span className="text-xs text-white/80 font-mono tabular-nums w-16 text-right">
        Year {Math.floor(elapsedYears)}
      </span>
    </div>
  )

  if (!isClient) return null
  return createPortal(content, document.body)
}
