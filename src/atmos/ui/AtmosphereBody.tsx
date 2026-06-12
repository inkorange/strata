'use client'

import { cn } from '@/lib/utils'
import type { Season } from '@/src/atmos/solar'
import { useStore } from '@/src/store'
import { InspectReadout } from './InspectReadout'
import { Legend } from './Legend'
import { Timeline } from './Timeline'

const SEASONS: { id: Season; label: string }[] = [
  { id: 'equinox', label: 'Equinox' },
  { id: 'june-solstice', label: 'June' },
  { id: 'december-solstice', label: 'December' },
]

/**
 * Atmosphere module body root. Mounted into the ModuleFrame's sidebar.
 *
 * The sidebar holds the module's intro copy and the season picker. The
 * layer-toggle chips render via ModuleFrame's `headerAction` slot (next
 * to the "Atmosphere" title). The scrubber, inspect readout, and legend
 * portal themselves to the body via fixed positioning so they overlay
 * the globe canvas without the sidebar's `overflow: auto` clipping them.
 */
export function AtmosphereBody() {
  const season = useStore((s) => s.season)
  const setSeason = useStore((s) => s.setSeason)

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
          24-hour day cycle
        </div>
        <p className="text-[13px] leading-relaxed text-white/85">
          Scrub the timeline to advance the sun. Hover any point on the globe to inspect local
          conditions. Toggle the chips beside the title to peel layers — convection cells, surface
          temperature, and the equatorial cloud band.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
          Season
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {SEASONS.map((s) => {
            const active = season === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSeason(s.id)}
                aria-pressed={active}
                className={cn(
                  'rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors',
                  active
                    ? 'border-[#5cc6ff] bg-[rgba(92,198,255,0.18)] text-[#5cc6ff]'
                    : 'border-white/[0.08] bg-white/[0.03] text-white/65 hover:text-white/90 hover:bg-white/[0.06]',
                )}
              >
                {s.label}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] leading-snug text-white/55">
          Solstices tilt Earth's axis toward or away from the sun, shifting the bright cloud band,
          temperature gradient, and wind belts toward the summer hemisphere.
        </p>
      </div>

      <Timeline />
      <InspectReadout />
      <Legend />
    </>
  )
}
