import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function freshStore() {
  vi.resetModules()
  const mod = await import('@/src/store')
  return mod.useStore
}

describe('systemsSlice', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('defaults to the present-day scenario, not playing, zero elapsed years', async () => {
    const store = await freshStore()
    const s = store.getState()
    expect(s.scenario).toBe('present-day')
    expect(s.systemsPlaying).toBe(false)
    expect(s.elapsedYears).toBe(0)
    expect(s.masses.atmosphere).toBe(870)
    expect(s.fossilLever).toBeCloseTo(0.75, 6)
  })

  it('setFossilLever / setLandLever clamp to range', async () => {
    const store = await freshStore()
    store.getState().setFossilLever(5)
    expect(store.getState().fossilLever).toBe(1)
    store.getState().setFossilLever(-2)
    expect(store.getState().fossilLever).toBe(0)
    store.getState().setLandLever(9)
    expect(store.getState().landLever).toBe(1)
    store.getState().setLandLever(-9)
    expect(store.getState().landLever).toBe(-1)
  })

  it('setScenario reseeds masses, levers, and elapsed years', async () => {
    const store = await freshStore()
    store.getState().setFossilLever(0.1)
    store.getState().tickSystems(1)
    store.getState().setScenario('pre-industrial')
    const s = store.getState()
    expect(s.scenario).toBe('pre-industrial')
    expect(s.masses.atmosphere).toBe(590)
    expect(s.fossilLever).toBe(0)
    expect(s.elapsedYears).toBe(0)
  })

  it('tickSystems advances elapsed years and mutates masses', async () => {
    const store = await freshStore()
    store.getState().setScenario('pre-industrial')
    store.getState().setFossilLever(1)
    const before = store.getState().masses.atmosphere
    store.getState().tickSystems(2)
    expect(store.getState().elapsedYears).toBe(2)
    expect(store.getState().masses.atmosphere).toBeGreaterThan(before)
  })

  it('toggleSystemsPlaying flips playback', async () => {
    const store = await freshStore()
    expect(store.getState().systemsPlaying).toBe(false)
    store.getState().toggleSystemsPlaying()
    expect(store.getState().systemsPlaying).toBe(true)
  })

  it('resetSystems restores the active scenario seed and stops playback', async () => {
    const store = await freshStore()
    store.getState().setFossilLever(1)
    store.getState().tickSystems(10)
    store.getState().toggleSystemsPlaying()
    store.getState().resetSystems()
    const s = store.getState()
    expect(s.masses.atmosphere).toBe(870)
    expect(s.fossilLever).toBeCloseTo(0.75, 6)
    expect(s.elapsedYears).toBe(0)
    expect(s.systemsPlaying).toBe(false)
  })
})
