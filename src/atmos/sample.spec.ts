import { describe, expect, it } from 'vitest'
import { sampleAt } from './sample'

describe('sampleAt — temperature', () => {
  it('is warmest at the equator at noon', () => {
    const s = sampleAt(0, 0, 12)
    // Base 30°C at eq + 5°C illuminated = 35°C ballpark.
    expect(s.tempC).toBeGreaterThan(30)
    expect(s.tempC).toBeLessThan(40)
  })

  it('is much colder at the pole than at the equator (any hour)', () => {
    const eq = sampleAt(0, 0, 12)
    const pole = sampleAt(85, 0, 12)
    expect(pole.tempC).toBeLessThan(eq.tempC - 30)
  })

  it('night side is colder than day side at the same latitude', () => {
    const day = sampleAt(0, 0, 12)   // sun overhead
    const night = sampleAt(0, 180, 12) // antipode
    expect(night.tempC).toBeLessThan(day.tempC)
  })

  it('is symmetric across the equator (|lat| only)', () => {
    expect(sampleAt(30, 50, 12).tempC).toBeCloseTo(sampleAt(-30, 50, 12).tempC, 5)
  })
})

describe('sampleAt — pressure', () => {
  it('is highest at the subtropical highs (±30°)', () => {
    const eq = sampleAt(0, 0, 12).pressureHpa
    const subtrop = sampleAt(30, 0, 12).pressureHpa
    const subpolar = sampleAt(60, 0, 12).pressureHpa
    expect(subtrop).toBeGreaterThan(eq)
    expect(subtrop).toBeGreaterThan(subpolar)
  })

  it('falls back to a subpolar low at 60°', () => {
    const subtrop = sampleAt(30, 0, 12).pressureHpa
    const subpolar = sampleAt(60, 0, 12).pressureHpa
    expect(subpolar).toBeLessThan(subtrop)
  })

  it('is in a realistic surface band 1000–1025 hPa', () => {
    for (const lat of [0, 15, 30, 45, 60, 75, 90]) {
      const p = sampleAt(lat, 0, 12).pressureHpa
      expect(p).toBeGreaterThanOrEqual(1000)
      expect(p).toBeLessThanOrEqual(1025)
    }
  })
})

describe('sampleAt — dewpoint', () => {
  it('never exceeds temperature', () => {
    for (const lat of [-90, -45, 0, 45, 90]) {
      const s = sampleAt(lat, 0, 12)
      expect(s.dewpointC).toBeLessThanOrEqual(s.tempC)
    }
  })

  it('is closer to temp in the humid tropics than at the dry poles', () => {
    const tropics = sampleAt(0, 0, 12)
    const pole = sampleAt(85, 0, 12)
    expect(tropics.tempC - tropics.dewpointC).toBeLessThan(pole.tempC - pole.dewpointC)
  })
})

describe('sampleAt — lapse rate', () => {
  it('is the standard 6.5°C/km everywhere for v1', () => {
    expect(sampleAt(0, 0, 12).lapseCPerKm).toBeCloseTo(6.5, 5)
    expect(sampleAt(85, 175, 0).lapseCPerKm).toBeCloseTo(6.5, 5)
  })
})

describe('sampleAt — verbal labels', () => {
  it('returns WARM at the tropics', () => {
    expect(sampleAt(0, 0, 12).labels.temp).toBe('WARM')
  })

  it('returns COLD at the poles', () => {
    expect(sampleAt(85, 0, 12).labels.temp).toBe('COLD')
  })

  it('returns BREEZY in the trade wind band (|lat| < 30)', () => {
    expect(sampleAt(15, 0, 12).labels.wind).toBe('BREEZY')
  })

  it('returns WINDY in the mid-latitude westerly band', () => {
    expect(sampleAt(45, 0, 12).labels.wind).toBe('WINDY')
  })

  it('returns CALM at the poles (polar high)', () => {
    expect(sampleAt(85, 0, 12).labels.wind).toBe('CALM')
  })

  it('returns HUMID where dewpoint spread is small (tropics)', () => {
    expect(sampleAt(0, 0, 12).labels.humidity).toBe('HUMID')
  })

  it('returns DRY where dewpoint spread is large (poles)', () => {
    expect(sampleAt(85, 0, 12).labels.humidity).toBe('DRY')
  })

  it('echoes lat/lng on the sample', () => {
    const s = sampleAt(40, -90, 14)
    expect(s.lat).toBe(40)
    expect(s.lng).toBe(-90)
  })

  it('crosses the temp WARM/MILD boundary at exactly 25°C', () => {
    // tempLabel: c >= 25 → WARM. Construct via |lat| so base temp falls
    // ~0.45°C/deg. Day side adds +5°C; at lat=0 lng=0 h=12 we get ~35°C.
    // Pick a latitude where unsunlit temp lands just under/over the boundary.
    const justAbove = sampleAt(11, 90, 12) // not illuminated (sun at 0,0); temp ~ 30 - 0.45*11 = 25.05
    const justBelow = sampleAt(12, 90, 12) // temp ~ 30 - 0.45*12 = 24.6
    expect(justAbove.labels.temp).toBe('WARM')
    expect(justBelow.labels.temp).toBe('MILD')
  })

  it('crosses the wind BREEZY/WINDY boundary at |lat| = 30', () => {
    expect(sampleAt(29.9, 0, 12).labels.wind).toBe('BREEZY')
    expect(sampleAt(30, 0, 12).labels.wind).toBe('WINDY')
    expect(sampleAt(30.1, 0, 12).labels.wind).toBe('WINDY')
  })

  it('crosses the wind WINDY/CALM boundary at |lat| = 60', () => {
    expect(sampleAt(59.9, 0, 12).labels.wind).toBe('WINDY')
    expect(sampleAt(60, 0, 12).labels.wind).toBe('CALM')
    expect(sampleAt(60.1, 0, 12).labels.wind).toBe('CALM')
  })
})
