/** The four carbon reservoirs, in a fixed display/iteration order. */
export const RESERVOIR_KEYS = ['atmosphere', 'ocean', 'biosphere', 'lithosphere'] as const
export type ReservoirKey = (typeof RESERVOIR_KEYS)[number]

/** Carbon mass per reservoir, in gigatonnes of carbon (GtC). */
export type Masses = Record<ReservoirKey, number>

/** Pre-industrial baseline masses (GtC). Textbook round figures — honest, not
 *  research-grade (DESIGN.md §12). Used as integration anchors + gauge ranges. */
export const BASELINE_MASSES: Masses = {
  atmosphere: 590,
  ocean: 38_000,
  biosphere: 2_000,
  lithosphere: 75_000_000,
}

export type ScenarioId = 'pre-industrial' | 'present-day' | 'high-emissions'

export interface Scenario {
  id: ScenarioId
  label: string
  masses: Masses
  fossilLever: number // 0..1
  landLever: number // -1..1
}

/** Scenario seeds. present-day / high-emissions deliberately start with an
 *  elevated atmosphere so they are OUT of equilibrium and visibly evolve. */
export const SCENARIOS: Record<ScenarioId, Scenario> = {
  'pre-industrial': {
    id: 'pre-industrial',
    label: 'Pre-industrial',
    masses: { ...BASELINE_MASSES },
    fossilLever: 0,
    landLever: 0,
  },
  'present-day': {
    id: 'present-day',
    label: 'Present day',
    masses: { ...BASELINE_MASSES, atmosphere: 870 },
    fossilLever: 0.75,
    landLever: 0.25,
  },
  'high-emissions': {
    id: 'high-emissions',
    label: 'High emissions',
    masses: { ...BASELINE_MASSES, atmosphere: 870 },
    fossilLever: 1,
    landLever: 0.5,
  },
}

export const SCENARIO_LIST: Scenario[] = Object.values(SCENARIOS)
