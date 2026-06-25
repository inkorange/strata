// src/tutor/sceneToPrompt.spec.ts
import { describe, expect, it } from 'vitest'
import { BASELINE_MASSES } from '@/src/systems/carbonModel'
import { type SceneSnapshot, sceneToPrompt } from '@/src/tutor/sceneToPrompt'

const base: SceneSnapshot = {
  activeModule: 'hub',
  currentEraId: 'present',
  targetEraId: null,
  season: 'equinox',
  hour: 12,
  layers: { cells: true, temp: true, clouds: true },
  scenario: 'present-day',
  fossilLever: 0.5,
  landLever: 0.25,
  elapsedYears: 0,
  masses: { ...BASELINE_MASSES, atmosphere: 900 },
}

describe('sceneToPrompt', () => {
  it('describes the hub', () => {
    expect(sceneToPrompt({ ...base, activeModule: 'hub' })).toMatch(/home screen/i)
  })

  it('names the tectonics era and uses the target era while transitioning', () => {
    const s = sceneToPrompt({
      ...base,
      activeModule: 'tectonics',
      currentEraId: 'present',
      targetEraId: 'late-cretaceous',
    })
    expect(s).toMatch(/Late Cretaceous/)
    expect(s).toMatch(/million years ago/)
  })

  it('describes the atmosphere season, time, and active layers', () => {
    const s = sceneToPrompt({
      ...base,
      activeModule: 'atmosphere',
      season: 'june-solstice',
      hour: 13.5,
      layers: { cells: true, temp: false, clouds: true },
    })
    expect(s).toMatch(/June solstice/)
    expect(s).toMatch(/13:30/)
    expect(s).toMatch(/cells/i)
    expect(s).toMatch(/cloud band/i)
    expect(s).not.toMatch(/temperature/i)
  })

  it('describes the carbon scenario, levers, year, and atmosphere trend', () => {
    const s = sceneToPrompt({
      ...base,
      activeModule: 'systems',
      scenario: 'high-emissions',
      fossilLever: 1,
      landLever: 0.5,
      elapsedYears: 80,
      masses: { ...BASELINE_MASSES, atmosphere: 1200 }, // above the 870 seed → rising
    })
    expect(s).toMatch(/High emissions/)
    expect(s).toMatch(/12(\.0)? GtC\/yr/) // fossilLever 1 × MAX_FOSSIL 12
    expect(s).toMatch(/deforest/i)
    expect(s).toMatch(/year 80/i)
    expect(s).toMatch(/rising/i)
  })
})
