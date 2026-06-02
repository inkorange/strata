'use client'

import { ChipBar } from './ChipBar'
import { InspectReadout } from './InspectReadout'
import { Legend } from './Legend'
import { Timeline } from './Timeline'

/**
 * Atmosphere module body root. Mounted into the ModuleFrame's sidebar.
 *
 * The sidebar holds the module's static intro copy. The chips, scrubber,
 * inspect readout, and legend portal themselves to the body via fixed
 * positioning so they overlay the globe canvas without the sidebar's
 * `overflow: auto` clipping them.
 */
export function AtmosphereBody() {
  return (
    <>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">Atmosphere</h2>
          <p className="text-xs text-muted-foreground">24-hour day cycle</p>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Scrub the timeline to advance the sun. Hover any point on the globe to inspect local
          conditions. Toggle the chips below to peel layers — convection cells, surface temperature,
          and the equatorial cloud band.
        </p>
      </div>
      <ChipBar />
      <Timeline />
      <InspectReadout />
      <Legend />
    </>
  )
}
