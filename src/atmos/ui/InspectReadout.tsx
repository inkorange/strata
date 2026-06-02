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

/**
 * Top-left data readout. Hidden until the user hovers/taps the globe.
 * Renders three tiers of detail:
 *   - Beginner (mobile-lite):    big verbal labels (WARM · BREEZY · HUMID)
 *   - Standard  (balanced):      numbers (22°C · 1013 hPa · 14°dp) + location
 *   - Advanced  (desktop-ultra): + lapse rate + specific-humidity + tiny T(z) graph
 */
export function InspectReadout() {
  const inspectAt = useStore((s) => s.inspectAt)
  const hour = useStore((s) => s.hour)
  const tierOverride = useStore((s) => s.tierOverride)

  // SSR/hydration guard for the tier branch — matches TectonicsBody pattern.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!inspectAt) return null
  const [lat, lng] = inspectAt
  const s = sampleAt(lat, lng, hour)
  const effectiveTier = mounted ? tierOverride : null

  // Beginner
  if (effectiveTier === 'mobile-lite') {
    return (
      <div className="pointer-events-none fixed top-20 left-4 sm:top-24 sm:left-80 z-10 rounded-lg border border-border/40 bg-card/85 backdrop-blur px-4 py-3 text-foreground">
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
    <div className="pointer-events-none fixed top-20 left-4 sm:top-24 sm:left-80 z-10 rounded-lg border border-border/40 bg-card/85 backdrop-blur px-4 py-3 text-foreground font-mono tabular-nums">
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
