'use client'

import { useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

const BELTS = [
  { color: '#5cc6ff', label: 'Trade winds → equator' },
  { color: '#7ad9aa', label: 'Westerlies W → E' },
  { color: '#aa8fff', label: 'Polar easterlies E → W' },
]

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

/**
 * Atmospheric circulation legend, portaled to document.body so its `fixed`
 * positioning escapes the left sidebar's backdrop-filter containing block.
 *
 * Desktop (sm and up): always-open panel anchored top-right.
 * Mobile: collapsed by default into a small icon button with three
 * colored stripes (matching the three wind belts). Tapping the icon opens
 * the panel; tapping the close ✕ in the panel header dismisses it.
 */
export function Legend() {
  const isClient = useIsClient()
  const [open, setOpen] = useState(false)

  const content = (
    <>
      {/* Collapsed icon button — mobile only, hidden once panel is open. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Show atmospheric circulation legend"
        className={cn(
          'pointer-events-auto fixed top-20 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-[#0d0a1f]/95 backdrop-blur-xl shadow-[0_6px_24px_rgba(0,0,0,0.45)] transition-colors hover:bg-[#15102e]/95 sm:hidden',
          open && 'hidden',
        )}
      >
        <span aria-hidden className="flex flex-col gap-1">
          {BELTS.map((b) => (
            <span
              key={b.label}
              className="block h-[2px] w-5 rounded-full"
              style={{ backgroundColor: b.color, boxShadow: `0 0 6px ${b.color}66` }}
            />
          ))}
        </span>
      </button>

      {/* Legend panel — desktop: always visible. Mobile: visible only when
          `open`. Same DOM in both cases; only the visibility breakpoint differs. */}
      <aside
        className={cn(
          'pointer-events-auto fixed top-20 right-4 sm:top-24 sm:right-6 z-20 w-60 rounded-xl border border-white/[0.08] bg-[#0d0a1f]/95 backdrop-blur-xl sm:shadow-[0_6px_24px_rgba(0,0,0,0.45)]',
          !open && 'hidden sm:block',
        )}
        aria-label="Atmospheric circulation legend"
      >
        <header className="relative border-b border-white/[0.07] px-4 pt-3 pb-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
            Legend
          </div>
          <h2 className="mt-0.5 text-sm font-semibold tracking-tight text-white">
            Circulation
          </h2>
          {/* Close ✕ — mobile only. */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Hide legend"
            className="pointer-events-auto absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-base leading-none text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white sm:hidden"
          >
            ✕
          </button>
        </header>
        <ul className="space-y-2.5 px-4 py-3 text-[12px] leading-snug text-white/85">
          {BELTS.map((b) => (
            <li key={b.label} className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-block h-[3px] w-7 rounded-full"
                style={{ backgroundColor: b.color, boxShadow: `0 0 10px ${b.color}55` }}
              />
              <span>{b.label}</span>
            </li>
          ))}
          {/* Doldrums / ITCZ — calm convergence zone where the trade winds
              meet and air rises into the bright equatorial cloud band. Soft
              white-yellow radial gradient echoes the cloud-puff sprite so
              the symbol reads as cloud, not wind. */}
          <li className="mt-1 flex items-center gap-3 border-t border-white/[0.06] pt-2.5">
            <span
              aria-hidden
              className="inline-block h-3 w-7 rounded-full"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(255,250,220,0.95) 0%, rgba(255,220,160,0.55) 35%, rgba(255,180,100,0.12) 75%, rgba(255,180,100,0) 100%)',
                filter: 'blur(0.5px)',
              }}
            />
            <span>Doldrums (ITCZ) — rising air</span>
          </li>
        </ul>
      </aside>
    </>
  )

  if (!isClient) return null
  return createPortal(content, document.body)
}
