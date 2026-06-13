import type { StateCreator } from 'zustand'
import { type Masses, SCENARIOS, type ScenarioId } from './carbonModel'
import { project } from './step'

const DEFAULT_SCENARIO: ScenarioId = 'present-day'

/** Scrub range of the timeline, in simulated years. */
export const MAX_YEARS = 200

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export interface SystemsSlice {
  masses: Masses
  fossilLever: number // 0..1
  landLever: number // -1..1
  scenario: ScenarioId
  systemsPlaying: boolean
  /** Current position on the timeline, in years from the scenario seed (0..MAX_YEARS). */
  elapsedYears: number

  setFossilLever: (v: number) => void
  setLandLever: (v: number) => void
  setScenario: (id: ScenarioId) => void
  toggleSystemsPlaying: () => void
  /** Jump the timeline to an absolute year; masses are re-projected from the
   *  scenario seed at the current levers. Drag the scrubber or play both go
   *  through here, so the timeline is fully scrubbable. */
  setYear: (year: number) => void
  /** Advance the timeline by `dtYears` (used by playback). */
  tickSystems: (dtYears: number) => void
  resetSystems: () => void
}

function seed(id: ScenarioId) {
  const sc = SCENARIOS[id]
  return {
    scenario: id,
    masses: { ...sc.masses },
    fossilLever: sc.fossilLever,
    landLever: sc.landLever,
    elapsedYears: 0,
  }
}

/** Re-project masses for the given state at its current year + levers. */
function projectAt(scenario: ScenarioId, fossilLever: number, landLever: number, year: number) {
  return project(SCENARIOS[scenario].masses, fossilLever, landLever, year)
}

export const createSystemsSlice: StateCreator<SystemsSlice> = (set, get) => ({
  ...seed(DEFAULT_SCENARIO),
  systemsPlaying: false,

  setFossilLever: (v) => {
    const s = get()
    const fossilLever = clamp(v, 0, 1)
    set({ fossilLever, masses: projectAt(s.scenario, fossilLever, s.landLever, s.elapsedYears) })
  },

  setLandLever: (v) => {
    const s = get()
    const landLever = clamp(v, -1, 1)
    set({ landLever, masses: projectAt(s.scenario, s.fossilLever, landLever, s.elapsedYears) })
  },

  setScenario: (id) => set({ ...seed(id), systemsPlaying: get().systemsPlaying }),

  toggleSystemsPlaying: () => {
    const s = get()
    const willPlay = !s.systemsPlaying
    // Pressing play at the end of the scrub range restarts from year 0.
    if (willPlay && s.elapsedYears >= MAX_YEARS) s.setYear(0)
    set({ systemsPlaying: willPlay })
  },

  setYear: (year) => {
    const s = get()
    const clamped = clamp(year, 0, MAX_YEARS)
    set({
      elapsedYears: clamped,
      masses: projectAt(s.scenario, s.fossilLever, s.landLever, clamped),
    })
  },

  tickSystems: (dtYears) => {
    const s = get()
    const next = s.elapsedYears + dtYears
    s.setYear(next)
    // Stop playback when the scrub range is exhausted so it doesn't spin at the end.
    if (next >= MAX_YEARS && s.systemsPlaying) set({ systemsPlaying: false })
  },

  resetSystems: () => set({ ...seed(get().scenario), systemsPlaying: false }),
})
