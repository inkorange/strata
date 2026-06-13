import type { ComponentType } from 'react'
import { AtmosphereBody } from '@/src/atmos/ui/AtmosphereBody'
import { ChipBar } from '@/src/atmos/ui/ChipBar'
import type { ModuleId } from '@/src/store/shellSlice'
import { SystemsBody } from '@/src/systems/ui/SystemsBody'
import { SystemsResetButton } from '@/src/systems/ui/SystemsResetButton'
import { TectonicsBody } from '@/src/tectonics/ui/TectonicsBody'

export interface ModuleDef {
  id: Exclude<ModuleId, 'hub'>
  label: string
  shortLabel: string
  /** Hub card description. */
  blurb: string
  /** CSS var name from globals.css. */
  accentToken: '--color-accent-tectonics' | '--color-accent-atmosphere' | '--color-accent-systems'
  /** Resolved hex; mirrored from globals.css for use in inline styles + shaders. */
  accentHex: string
  /** Camera dolly target when entering this module.
   *
   * `direction` is the unit-vector direction from origin to camera (its
   * magnitude is ignored — CameraDolly recomputes the actual distance
   * from `fillRatio` and the current viewport aspect). `fillRatio` is the
   * fraction of the SMALLER viewport dimension that Earth should fill, so
   * the framing is consistent across desktop and mobile.
   */
  dolly: {
    direction: [number, number, number]
    fillRatio: number
    lookAt: [number, number, number]
  }
  /** Module body component rendered inside ModuleFrame. */
  Body: ComponentType
  /** Optional component rendered in the right side of the card header,
   *  alongside the module title. Use for compact module-level toggles
   *  (e.g. atmosphere layer chips) that belong with the title rather
   *  than floating over the canvas. */
  HeaderAction?: ComponentType
}

export const MODULES: Record<Exclude<ModuleId, 'hub'>, ModuleDef> = {
  tectonics: {
    id: 'tectonics',
    label: 'Tectonics',
    shortLabel: 'Crust',
    blurb: 'Drift plates, raise mountains, split rifts.',
    accentToken: '--color-accent-tectonics',
    accentHex: '#ff8c5a',
    // Head-on orbit, Earth fills 70% of the smaller viewport dimension —
    // close enough to read plate detail without overflowing the screen.
    dolly: { direction: [0, 0, 1], fillRatio: 0.7, lookAt: [0, 0, 0] },
    Body: TectonicsBody,
  },
  atmosphere: {
    id: 'atmosphere',
    label: 'Atmosphere',
    shortLabel: 'Sky',
    blurb: 'Form fronts, build clouds, trace storms.',
    accentToken: '--color-accent-atmosphere',
    accentHex: '#5cc6ff',
    // Slightly above horizon — the y/z ratio matches the previous hard-
    // coded position [0, 0.6, 2.4]. Earth fills 65% of the smaller dim so
    // there's room for the chips, scrubber, and inspect readout overlay.
    dolly: { direction: [0, 0.243, 0.97], fillRatio: 0.65, lookAt: [0, 0, 0] },
    Body: AtmosphereBody,
    HeaderAction: ChipBar,
  },
  systems: {
    id: 'systems',
    label: 'Earth Systems',
    shortLabel: 'Cycles',
    blurb: 'Move carbon between atmosphere, ocean, biosphere, lithosphere.',
    accentToken: '--color-accent-systems',
    accentHex: '#7ad9aa',
    // Pulled back to show reservoir flows around Earth.
    dolly: { direction: [0, 0, 1], fillRatio: 0.55, lookAt: [0, 0, 0] },
    Body: SystemsBody,
    HeaderAction: SystemsResetButton,
  },
}
