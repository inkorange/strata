import { describe, expect, it } from 'vitest'
import { BASELINE_MASSES, type Masses } from './carbonModel'
import { step } from './step'

function totalCarbon(m: Masses): number {
  return m.atmosphere + m.ocean + m.biosphere + m.lithosphere
}

const ZERO_LEVERS = { fossilLever: 0, landLever: 0 }

describe('step', () => {
  it('holds pre-industrial baseline at equilibrium (no drift, zero levers)', () => {
    let m = { ...BASELINE_MASSES }
    for (let i = 0; i < 200; i++) {
      m = step({ masses: m, ...ZERO_LEVERS }, 0.5)
    }
    expect(m.atmosphere).toBeCloseTo(BASELINE_MASSES.atmosphere, 3)
    expect(m.ocean).toBeCloseTo(BASELINE_MASSES.ocean, 3)
    expect(m.biosphere).toBeCloseTo(BASELINE_MASSES.biosphere, 3)
    expect(m.lithosphere).toBeCloseTo(BASELINE_MASSES.lithosphere, 1)
  })

  it('conserves total carbon across a random lever sequence', () => {
    let m = { ...BASELINE_MASSES, atmosphere: 870 }
    const total0 = totalCarbon(m)
    const levers = [
      { fossilLever: 1, landLever: 0.5 },
      { fossilLever: 0.3, landLever: -1 },
      { fossilLever: 0, landLever: 0 },
      { fossilLever: 0.9, landLever: 1 },
    ]
    for (const lv of levers) {
      for (let i = 0; i < 50; i++) m = step({ masses: m, ...lv }, 0.5)
    }
    expect(totalCarbon(m)).toBeCloseTo(total0, 2)
  })

  it('negative feedback: an elevated atmosphere relaxes toward baseline (zero levers)', () => {
    let m = { ...BASELINE_MASSES, atmosphere: 1200 }
    const start = m.atmosphere
    for (let i = 0; i < 100; i++) m = step({ masses: m, ...ZERO_LEVERS }, 0.5)
    expect(m.atmosphere).toBeLessThan(start)
    expect(m.atmosphere).toBeGreaterThan(BASELINE_MASSES.atmosphere)
  })

  it('fossil lever up grows atmosphere and drains lithosphere', () => {
    let m = { ...BASELINE_MASSES }
    for (let i = 0; i < 20; i++) m = step({ masses: m, fossilLever: 1, landLever: 0 }, 0.5)
    expect(m.atmosphere).toBeGreaterThan(BASELINE_MASSES.atmosphere)
    expect(m.lithosphere).toBeLessThan(BASELINE_MASSES.lithosphere)
  })

  it('reforestation (landLever < 0) drains atmosphere and grows biosphere', () => {
    let m = { ...BASELINE_MASSES }
    for (let i = 0; i < 20; i++) m = step({ masses: m, fossilLever: 0, landLever: -1 }, 0.5)
    expect(m.atmosphere).toBeLessThan(BASELINE_MASSES.atmosphere)
    expect(m.biosphere).toBeGreaterThan(BASELINE_MASSES.biosphere)
  })

  it('never drives a reservoir negative within the valid lever envelope', () => {
    let m = { ...BASELINE_MASSES }
    for (let i = 0; i < 500; i++) m = step({ masses: m, fossilLever: 1, landLever: 1 }, 0.5)
    for (const k of Object.keys(m) as (keyof Masses)[]) expect(m[k]).toBeGreaterThan(0)
  })
})
