'use client'

import { useEffect, useState } from 'react'
import { sampleAt } from '@/src/atmos/sample'
import { useStore } from '@/src/store'

function formatHour(h: number): string {
  const hh = Math.floor(h)
  const mm = Math.floor((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function formatLat(lat: number): string {
  const ns = lat >= 0 ? 'N' : 'S'
  return `${Math.abs(lat).toFixed(0)}°${ns}`
}

function formatLng(lng: number): string {
  const ew = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lng).toFixed(0)}°${ew}`
}

/** Approximate readout footprint used for viewport-edge clamping. */
const READOUT_W = 240
const READOUT_H = 110
const READOUT_OFFSET = 14

/** Position the readout near (x, y) but flip / clamp so it stays fully
 *  on-screen. Prefers below-right of the cursor; flips to above / left
 *  when too close to the viewport edge. */
function anchorStyle(x: number, y: number): { left: number; top: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  let left = x + READOUT_OFFSET
  let top = y + READOUT_OFFSET
  if (left + READOUT_W > vw - 8) left = x - READOUT_W - READOUT_OFFSET
  if (top + READOUT_H > vh - 8) top = y - READOUT_H - READOUT_OFFSET
  if (left < 8) left = 8
  if (top < 8) top = 8
  return { left, top }
}

/**
 * Data readout that anchors at the user's click/hover point on the globe.
 * Hidden until the user interacts. Renders three tiers of detail:
 *   - Beginner (mobile-lite):    big verbal labels (WARM · BREEZY · HUMID)
 *   - Standard  (balanced):      numbers (22°C · 1013 hPa · 14°dp) + location
 *   - Advanced  (desktop-ultra): + lapse rate + specific-humidity + tiny T(z) graph
 */
export function InspectReadout() {
  const inspectAt = useStore((s) => s.inspectAt)
  const inspectScreen = useStore((s) => s.inspectScreen)
  const hour = useStore((s) => s.hour)
  const season = useStore((s) => s.season)
  const tierOverride = useStore((s) => s.tierOverride)

  // SSR/hydration guard for the tier branch — matches TectonicsBody pattern.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!inspectAt || !inspectScreen) return null
  const [lat, lng] = inspectAt
  const s = sampleAt(lat, lng, hour, season)
  const effectiveTier = mounted ? tierOverride : null
  const pos = anchorStyle(inspectScreen.x, inspectScreen.y)

  // Beginner
  if (effectiveTier === 'mobile-lite') {
    return (
      <div
        style={pos}
        className="pointer-events-none fixed z-10 rounded-lg border border-border/40 bg-card/95 backdrop-blur px-4 py-3 text-foreground shadow-[0_6px_24px_rgba(0,0,0,0.45)]"
      >
        <div className="text-xs uppercase tracking-wider text-[#5cc6ff] mb-1">Conditions</div>
        <div className="text-lg font-semibold leading-tight">{s.labels.temp}</div>
        <div className="text-lg font-semibold leading-tight">{s.labels.wind}</div>
        <div className="text-lg font-semibold leading-tight">{s.labels.humidity}</div>
      </div>
    )
  }

  // Advanced — extra rows + tiny vertical-temperature graph
  const isAdvanced = effectiveTier === 'desktop-ultra'

  // T(z) using lapse rate over a 10 km column. Plot as 60×40 SVG, T-axis horizontal.
  const altitudes = Array.from({ length: 11 }, (_, i) => i) // km, 0..10
  const temps = altitudes.map((alt) => s.tempC - s.lapseCPerKm * alt)
  const minT = Math.min(...temps)
  const maxT = Math.max(...temps)
  const path = altitudes
    .map((alt, i) => {
      const x = ((temps[i]! - minT) / (maxT - minT || 1)) * 56 + 2
      const y = 38 - (alt / 10) * 36
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  // Specific humidity from dewpoint (g/kg) — Magnus approximation.
  const e = 6.112 * Math.exp((17.67 * s.dewpointC) / (s.dewpointC + 243.5)) // hPa
  const q = (0.622 * e) / (s.pressureHpa - 0.378 * e) // mixing ratio kg/kg
  const qGPerKg = q * 1000

  return (
    <div
      style={pos}
      className="pointer-events-none fixed z-10 rounded-lg border border-border/40 bg-card/95 backdrop-blur px-4 py-3 text-foreground font-mono tabular-nums shadow-[0_6px_24px_rgba(0,0,0,0.45)]"
    >
      <div className="text-xs uppercase tracking-wider text-[#5cc6ff] mb-1 font-sans">
        {formatLat(lat)} · {formatLng(lng)} · {formatHour(hour)}
      </div>
      <div className="text-sm">
        {s.tempC.toFixed(0)}°C · {s.pressureHpa.toFixed(0)} hPa · {s.dewpointC.toFixed(0)}°dp
      </div>
      {isAdvanced && (
        <>
          <div className="text-xs text-foreground/70 mt-1">
            lapse {s.lapseCPerKm.toFixed(1)}°C/km · q {qGPerKg.toFixed(1)} g/kg
          </div>
          <svg width="60" height="40" className="mt-2" aria-label="Temperature vs altitude">
            <path d={path} stroke="#5cc6ff" strokeWidth="1.5" fill="none" />
            <text x="2" y="38" fontSize="6" fill="currentColor" opacity="0.6">
              0
            </text>
            <text x="2" y="8" fontSize="6" fill="currentColor" opacity="0.6">
              10km
            </text>
          </svg>
        </>
      )}
    </div>
  )
}
