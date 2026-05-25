import type { ComponentType } from 'react'
import type { ModuleId } from '@/src/store/shellSlice'
import { TectonicsBody } from '@/src/tectonics/ui/TectonicsBody'
import { StubModuleBody } from './StubModuleBody'

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
  /** Camera dolly target when entering this module. */
  dolly: {
    position: [number, number, number]
    lookAt: [number, number, number]
  }
  /** Module body component rendered inside ModuleFrame. */
  Body: ComponentType
}

function makeStub(label: string, accent: string): ComponentType {
  return function Stub() {
    return <StubModuleBody moduleLabel={label} accent={accent} />
  }
}

export const MODULES: Record<Exclude<ModuleId, 'hub'>, ModuleDef> = {
  tectonics: {
    id: 'tectonics',
    label: 'Tectonics',
    shortLabel: 'Crust',
    blurb: 'Drift plates, raise mountains, split rifts.',
    accentToken: '--color-accent-tectonics',
    accentHex: '#ff8c5a',
    // Dolly into the crust: camera dives toward the surface from current orbit.
    dolly: { position: [0, 0, 1.6], lookAt: [0, 0, 0] },
    Body: TectonicsBody,
  },
  atmosphere: {
    id: 'atmosphere',
    label: 'Atmosphere',
    shortLabel: 'Sky',
    blurb: 'Form fronts, build clouds, trace storms.',
    accentToken: '--color-accent-atmosphere',
    accentHex: '#5cc6ff',
    // Pull back to the sky layer: a higher orbit gives a horizon view.
    dolly: { position: [0, 0.6, 2.4], lookAt: [0, 0, 0] },
    Body: makeStub('Atmosphere', '#5cc6ff'),
  },
  systems: {
    id: 'systems',
    label: 'Earth Systems',
    shortLabel: 'Cycles',
    blurb: 'Move carbon between atmosphere, ocean, biosphere, lithosphere.',
    accentToken: '--color-accent-systems',
    accentHex: '#7ad9aa',
    // Overlay cycles onto the globe: orbit similar to hub but slightly closer.
    dolly: { position: [0, 0, 4], lookAt: [0, 0, 0] },
    Body: makeStub('Earth Systems', '#7ad9aa'),
  },
}

export const HUB_DOLLY = {
  position: [0, 0, 6] as [number, number, number],
  lookAt: [0, 0, 0] as [number, number, number],
}
