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
})
