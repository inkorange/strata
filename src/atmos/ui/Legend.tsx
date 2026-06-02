'use client'

import { useState } from 'react'

const BELTS = [
  { color: '#5cc6ff', label: 'Trade winds → equator' },
  { color: '#7ad9aa', label: 'Westerlies W → E' },
  { color: '#aa8fff', label: 'Polar easterlies E → W' },
]

/**
 * Top-right wind-belt color legend. Collapsed-by-default into a single
 * chevron button; clicking expands the three rows inline. Always positioned
 * top-right; doesn't interfere with the tier-toggle chip in the header.
 */
export function Legend() {
  const [open, setOpen] = useState(false)

  return (
    <div className="pointer-events-auto fixed top-20 right-4 sm:top-24 sm:right-6 z-10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-border/40 bg-card/85 backdrop-blur px-3 py-2 text-xs text-foreground/80 hover:text-foreground"
        aria-expanded={open}
        aria-label={open ? 'Hide wind-belt legend' : 'Show wind-belt legend'}
      >
        Wind belts {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-border/40 bg-card/85 backdrop-blur px-3 py-2 text-xs leading-relaxed">
          {BELTS.map((b) => (
            <div key={b.label} className="flex items-center gap-2 text-foreground/85">
              <span
                aria-hidden
                className="inline-block w-3 h-0.5 rounded-full"
                style={{ backgroundColor: b.color }}
              />
              <span>{b.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
