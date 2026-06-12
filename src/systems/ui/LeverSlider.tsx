'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface LeverSliderProps {
  label: string
  /** Current value. */
  value: number
  min: number
  max: number
  /** Called with the new clamped value as the user drags / clicks. */
  onChange: (v: number) => void
  /** CSS color for the filled portion + knob glow. */
  accent: string
  /** Optional value→text for the readout (e.g. "9 GtC/yr"). */
  format?: (v: number) => string
}

/**
 * Horizontal track-and-knob lever. Mirrors the interaction grammar of the
 * Atmosphere Timeline scrubber: click anywhere on the track to set, drag the
 * knob to scrub (pointermove on window so it keeps following off-track).
 * Exposes `role="slider"` with aria-value attributes for a11y + e2e.
 */
export function LeverSlider({
  label,
  value,
  min,
  max,
  onChange,
  accent,
  format,
}: LeverSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      onChange(min + t * (max - min))
    },
    [min, max, onChange],
  )

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

  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-white/80">{label}</span>
        {format && (
          <span className="text-[11px] font-mono tabular-nums text-white/55">{format(value)}</span>
        )}
      </div>
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          setDragging(true)
          setFromClientX(e.clientX)
        }}
        className="relative h-2 cursor-pointer rounded-full bg-white/[0.08]"
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: accent, opacity: 0.6 }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full"
          style={{
            left: `calc(${pct}% - 8px)`,
            backgroundColor: accent,
            boxShadow: `0 0 10px ${accent}`,
          }}
        />
      </div>
    </div>
  )
}
