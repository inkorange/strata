'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '@/src/store'
import { RESERVOIR_KEYS, type ReservoirKey } from '@/src/systems/carbonModel'
import { DISPLAY_RANGES, normalizeMass } from '@/src/systems/display'

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

const RESERVOIR_META: Record<ReservoirKey, { label: string; color: string }> = {
  atmosphere: { label: 'Atmosphere', color: '#5cc6ff' },
  ocean: { label: 'Ocean', color: '#6fa8ff' },
  biosphere: { label: 'Biosphere', color: '#7ad9aa' },
  lithosphere: { label: 'Lithosphere', color: '#ff8c5a' },
}

function formatGtC(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return v.toFixed(0)
}

/**
 * Grouped four-reservoir gauge panel. Portaled (like the Atmosphere overlays)
 * so the sidebar's overflow doesn't clip it. Mobile: compact 4-up row pinned
 * under the top nav. Desktop: vertical panel pinned top-right. Tier-aware:
 * Beginner (mobile-lite) hides GtC numbers and shows a trend arrow.
 */
export function ReservoirGauges() {
  const masses = useStore((s) => s.masses)
  const tierOverride = useStore((s) => s.tierOverride)
  const isClient = useIsClient()

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Track previous masses to derive a trend arrow (qualitative tier).
  const prevRef = useRef(masses)
  const trend: Record<ReservoirKey, number> = {
    atmosphere: masses.atmosphere - prevRef.current.atmosphere,
    ocean: masses.ocean - prevRef.current.ocean,
    biosphere: masses.biosphere - prevRef.current.biosphere,
    lithosphere: masses.lithosphere - prevRef.current.lithosphere,
  }
  prevRef.current = masses

  if (!isClient) return null
  const showNumbers = !mounted || tierOverride !== 'mobile-lite'

  // Mobile: compact 4-up row pinned under the top nav (won't fight the bottom
  // card or scrubber). Desktop: vertical panel pinned top-right.
  const content = (
    <aside
      aria-label="Carbon reservoir gauges"
      className="pointer-events-auto fixed z-20 flex select-none gap-2 rounded-lg border border-white/[0.08] bg-[#0d0a1f]/92 p-3 backdrop-blur-xl
        top-16 inset-x-4 flex-row
        sm:top-24 sm:right-4 sm:left-auto sm:inset-x-auto sm:w-56 sm:flex-col"
    >
      <div className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 sm:block">
        Reservoirs (GtC)
      </div>
      {RESERVOIR_KEYS.map((k) => {
        const meta = RESERVOIR_META[k]
        const fill = normalizeMass(masses[k], DISPLAY_RANGES[k][0], DISPLAY_RANGES[k][1])
        const arrow = trend[k] > 0.001 ? '▲' : trend[k] < -0.001 ? '▼' : '■'
        return (
          <div key={k} className="flex flex-1 flex-col gap-1 sm:flex-none">
            <div className="flex items-baseline justify-between gap-1 text-[10px] sm:text-[11px]">
              <span className="truncate" style={{ color: meta.color }}>
                {meta.label}
              </span>
              <span className="font-mono tabular-nums text-white/65">
                {showNumbers ? formatGtC(masses[k]) : arrow}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full"
                style={{ width: `${fill * 100}%`, backgroundColor: meta.color, opacity: 0.7 }}
              />
            </div>
          </div>
        )
      })}
    </aside>
  )

  return createPortal(content, document.body)
}
