import { describe, expect, it } from 'vitest'
import {
  BASELINE_MASSES,
  RESERVOIR_KEYS,
  SCENARIOS,
  type ReservoirKey,
} from './carbonModel'

describe('carbonModel', () => {
  it('defines the four reservoirs in fixed order', () => {
    expect(RESERVOIR_KEYS).toEqual(['atmosphere', 'ocean', 'biosphere', 'lithosphere'])
  })

  it('baseline masses match the spec table (GtC)', () => {
    expect(BASELINE_MASSES).toEqual({
      atmosphere: 590,
      ocean: 38_000,
      biosphere: 2_000,
      lithosphere: 75_000_000,
    })
  })

  it('pre-industrial scenario seeds baseline masses and zero levers', () => {
    expect(SCENARIOS['pre-industrial'].masses).toEqual(BASELINE_MASSES)
    expect(SCENARIOS['pre-industrial'].fossilLever).toBe(0)
    expect(SCENARIOS['pre-industrial'].landLever).toBe(0)
  })

  it('present-day and high-emissions seed an elevated atmosphere', () => {
    expect(SCENARIOS['present-day'].masses.atmosphere).toBe(870)
    expect(SCENARIOS['high-emissions'].masses.atmosphere).toBe(870)
    expect(SCENARIOS['present-day'].fossilLever).toBeGreaterThan(0)
    expect(SCENARIOS['high-emissions'].fossilLever).toBe(1)
  })

  it('every scenario lever is in range', () => {
    for (const s of Object.values(SCENARIOS)) {
      expect(s.fossilLever).toBeGreaterThanOrEqual(0)
      expect(s.fossilLever).toBeLessThanOrEqual(1)
      expect(s.landLever).toBeGreaterThanOrEqual(-1)
      expect(s.landLever).toBeLessThanOrEqual(1)
    }
  })

  it('non-atmosphere reservoirs are seeded at baseline in every scenario', () => {
    const others: ReservoirKey[] = ['ocean', 'biosphere', 'lithosphere']
    for (const s of Object.values(SCENARIOS)) {
      for (const k of others) expect(s.masses[k]).toBe(BASELINE_MASSES[k])
    }
  })
})
