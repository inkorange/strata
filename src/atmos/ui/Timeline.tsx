'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '@/src/store'

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

function formatHour(h: number): string {
  const hh = Math.floor(h)
  const mm = Math.floor((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Real seconds per simulated hour during playback. 1.25s/hour → 30s per full day. */
const SECONDS_PER_HOUR = 1.25

/**
 * 24-hour day-cycle scrubber rendered at the bottom of the viewport.
 *
 * Visually mirrors Tectonics' Timeline placement (fixed, portaled to body,
 * sidebar offset on desktop). Track shows a day-cycle gradient (midnight →
 * sunrise → noon → sunset → midnight). Click anywhere on the track to jump;
 * drag the knob to scrub. Play/stop loops the day cycle continuously (~30s
 * per full day) via requestAnimationFrame so it tracks the monitor refresh.
 */
export function Timeline() {
  const hour = useStore((s) => s.hour)
  const setHour = useStore((s) => s.setHour)
  const playing = useStore((s) => s.playing)
  const togglePlaying = useStore((s) => s.togglePlaying)
  const isClient = useIsClient()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      setHour(t * 24)
    },
    [setHour],
  )

  // Drag handlers (pointermove on window so the knob keeps following even
  // when the cursor leaves the track).
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => updateFromClientX(e.clientX)
    const onUp = () => setDragging(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, updateFromClientX])

  // Playback loop: rAF advances `hour` by real-time delta / SECONDS_PER_HOUR
  // while playing, wrapping at 24 so the cycle loops cleanly. Reading the
  // current hour via store.getState() inside the frame avoids closing over
  // a stale value.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let lastT = performance.now()
    const step = (now: number) => {
      const dt = (now - lastT) / 1000
      lastT = now
      const current = useStore.getState().hour
      let next = current + dt / SECONDS_PER_HOUR
      while (next >= 24) next -= 24
      setHour(next)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, setHour])

  const content = (
    <div className="pointer-events-auto fixed z-20 bottom-4 inset-x-4 sm:left-80 sm:right-4 flex items-center gap-3 rounded-lg border border-border/40 bg-card/85 px-4 py-3 backdrop-blur">
      <button
        type="button"
        onClick={() => togglePlaying()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-card text-foreground hover:bg-foreground/10"
        aria-label={playing ? 'Stop day cycle' : 'Play day cycle'}
        aria-pressed={playing}
      >
        {playing ? '◼' : '▶'}
      </button>
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          setDragging(true)
          updateFromClientX(e.clientX)
        }}
        className="relative flex-1 h-2 rounded-full cursor-pointer"
        style={{
          background:
            'linear-gradient(90deg, #1a3a5a 0%, #ff8c5a 25%, #ffd9a0 50%, #ff8c5a 75%, #1a3a5a 100%)',
          opacity: 0.6,
        }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-[#5cc6ff] shadow-[0_0_10px_#5cc6ff]"
          style={{ left: `calc(${(hour / 24) * 100}% - 8px)` }}
          aria-label={`Time of day: ${formatHour(hour)}`}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={24}
          aria-valuenow={hour}
        />
      </div>
      <span className="text-xs text-foreground/80 font-mono tabular-nums w-12 text-right">
        {formatHour(hour)}
      </span>
    </div>
  )

  if (!isClient) return null
  return createPortal(content, document.body)
}
