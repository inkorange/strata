import type { StateCreator } from 'zustand'
import { type Masses, type ScenarioId, SCENARIOS } from './carbonModel'
import { step } from './step'

const DEFAULT_SCENARIO: ScenarioId = 'present-day'

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export interface SystemsSlice {
  masses: Masses
  fossilLever: number // 0..1
  landLever: number // -1..1
  scenario: ScenarioId
  systemsPlaying: boolean
  elapsedYears: number

  setFossilLever: (v: number) => void
  setLandLever: (v: number) => void
  setScenario: (id: ScenarioId) => void
  toggleSystemsPlaying: () => void
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

export const createSystemsSlice: StateCreator<SystemsSlice> = (set, get) => ({
  ...seed(DEFAULT_SCENARIO),
  systemsPlaying: false,

  setFossilLever: (v) => set({ fossilLever: clamp(v, 0, 1) }),
  setLandLever: (v) => set({ landLever: clamp(v, -1, 1) }),

  setScenario: (id) => set({ ...seed(id), systemsPlaying: get().systemsPlaying }),

  toggleSystemsPlaying: () => set((s) => ({ systemsPlaying: !s.systemsPlaying })),

  tickSystems: (dtYears) => {
    const s = get()
    const masses = step(
      { masses: s.masses, fossilLever: s.fossilLever, landLever: s.landLever },
      dtYears,
    )
    set({ masses, elapsedYears: s.elapsedYears + dtYears })
  },

  resetSystems: () => set({ ...seed(get().scenario), systemsPlaying: false }),
})
