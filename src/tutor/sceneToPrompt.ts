// src/tutor/sceneToPrompt.ts
import type { Season } from '@/src/atmos/solar'
import type { ModuleId } from '@/src/store/shellSlice'
import { type Masses, SCENARIOS, type ScenarioId } from '@/src/systems/carbonModel'
import { MAX_FOSSIL } from '@/src/systems/step'
import type { Era } from '@/src/tectonics/eras'
import { ERAS_BY_ID } from '@/src/tectonics/eras'

/** Exactly the store fields the summarizer reads — decoupled from the Store type. */
export interface SceneSnapshot {
  activeModule: ModuleId
  currentEraId: Era['id']
  targetEraId: Era['id'] | null
  season: Season
  hour: number
  layers: { cells: boolean; temp: boolean; clouds: boolean }
  scenario: ScenarioId
  fossilLever: number
  landLever: number
  elapsedYears: number
  masses: Masses
}

const SEASON_LABEL: Record<Season, string> = {
  equinox: 'an equinox',
  'june-solstice': 'the June solstice',
  'december-solstice': 'the December solstice',
}

function eraPhrase(mya: number): string {
  if (mya > 0) return `${mya} million years ago`
  if (mya === 0) return 'today'
  return `${-mya} million years from now`
}

function hhmm(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.floor((hour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Build a short, model-facing description of the current scene. Pure. */
export function sceneToPrompt(s: SceneSnapshot): string {
  if (s.activeModule === 'tectonics') {
    const era = ERAS_BY_ID[s.targetEraId ?? s.currentEraId]
    return `The student is in the Tectonics module, viewing the ${era.name} (${eraPhrase(
      era.mya,
    )}). The continents and tectonic plates are shown as they were in that era.`
  }

  if (s.activeModule === 'atmosphere') {
    const on: string[] = []
    if (s.layers.cells) on.push('convection cells / wind belts')
    if (s.layers.temp) on.push('the surface temperature heatmap')
    if (s.layers.clouds) on.push('the equatorial cloud band')
    const layers = on.length ? on.join(', ') : 'no overlays'
    return `The student is in the Atmosphere module: a 24-hour day-cycle view at ${
      SEASON_LABEL[s.season]
    }. Local time at the sub-solar meridian is about ${hhmm(s.hour)}. Visible layers: ${layers}.`
  }

  if (s.activeModule === 'systems') {
    const seedAtmos = SCENARIOS[s.scenario].masses.atmosphere
    const trend =
      s.masses.atmosphere > seedAtmos + 1
        ? 'rising'
        : s.masses.atmosphere < seedAtmos - 1
          ? 'falling'
          : 'roughly steady'
    const land =
      s.landLever > 0.02 ? 'deforesting' : s.landLever < -0.02 ? 'reforesting' : 'neutral'
    const fossil = (s.fossilLever * MAX_FOSSIL).toFixed(1)
    return `The student is in the Earth Systems carbon-cycle module. Scenario: ${
      SCENARIOS[s.scenario].label
    }. Fossil-fuel emissions: ${fossil} GtC/yr. Land use: ${land}. Simulated year ${
      s.elapsedYears
    }. The atmospheric carbon reservoir is ${trend}.`
  }

  return 'The student is on the Strata home screen, choosing a module (Tectonics, Atmosphere, or Earth Systems).'
}
