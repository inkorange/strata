import { describe, expect, it } from 'vitest'
import { DISPLAY_RANGES, normalizeMass } from './display'

describe('display', () => {
  it('clamps below min to 0 and above max to 1', () => {
    expect(normalizeMass(-5, 0, 10)).toBe(0)
    expect(normalizeMass(50, 0, 10)).toBe(1)
  })

  it('maps midpoint to 0.5', () => {
    expect(normalizeMass(5, 0, 10)).toBeCloseTo(0.5, 6)
  })

  it('handles a degenerate zero-width range without NaN', () => {
    expect(normalizeMass(5, 10, 10)).toBe(0)
  })

  it('defines a display range for every reservoir', () => {
    for (const k of ['atmosphere', 'ocean', 'biosphere', 'lithosphere'] as const) {
      const [min, max] = DISPLAY_RANGES[k]
      expect(max).toBeGreaterThan(min)
    }
  })
})
