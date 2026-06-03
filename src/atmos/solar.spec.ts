import { describe, expect, it } from 'vitest'
import { latLngToVec3 } from '@/src/tectonics/sphericalGeometry'
import {
  EARTH_TILT_DEG,
  itczBrightness,
  subsolarLatForSeason,
  subsolarPoint,
  sunDirection,
} from './solar'

describe('subsolarPoint', () => {
  it('returns (0, 0) at noon (h=12)', () => {
    const [lat, lng] = subsolarPoint(12)
    expect(lat).toBeCloseTo(0, 5)
    expect(lng).toBeCloseTo(0, 5)
  })

  it('returns (0, 180) at midnight (h=0)', () => {
    const [lat, lng] = subsolarPoint(0)
    expect(lat).toBeCloseTo(0, 5)
    expect(Math.abs(lng)).toBeCloseTo(180, 5)
  })

  it('returns (0, -90) at sunrise (h=6)', () => {
    const [lat, lng] = subsolarPoint(6)
    expect(lat).toBeCloseTo(0, 5)
    expect(lng).toBeCloseTo(-90, 5)
  })

  it('returns (0, 90) at sunset (h=18)', () => {
    const [lat, lng] = subsolarPoint(18)
    expect(lat).toBeCloseTo(0, 5)
    expect(lng).toBeCloseTo(90, 5)
  })

  it('always returns lat=0 at equinox (no tilt)', () => {
    for (const h of [0, 3, 6, 9, 12, 15, 18, 21]) {
      const [lat] = subsolarPoint(h)
      expect(lat).toBeCloseTo(0, 5)
    }
  })

  it('shifts to the Tropic of Cancer (+23.44°N) at June solstice', () => {
    for (const h of [0, 6, 12, 18]) {
      const [lat] = subsolarPoint(h, 'june-solstice')
      expect(lat).toBeCloseTo(EARTH_TILT_DEG, 5)
    }
  })

  it('shifts to the Tropic of Capricorn (-23.44°S) at December solstice', () => {
    for (const h of [0, 6, 12, 18]) {
      const [lat] = subsolarPoint(h, 'december-solstice')
      expect(lat).toBeCloseTo(-EARTH_TILT_DEG, 5)
    }
  })

  it('longitude advancement is independent of season', () => {
    // The hour-driven longitude sweep is the same regardless of orbital
    // position; only the subsolar latitude moves between seasons.
    for (const h of [0, 6, 12, 18]) {
      const [, lngEq] = subsolarPoint(h, 'equinox')
      const [, lngJun] = subsolarPoint(h, 'june-solstice')
      const [, lngDec] = subsolarPoint(h, 'december-solstice')
      expect(lngJun).toBeCloseTo(lngEq, 5)
      expect(lngDec).toBeCloseTo(lngEq, 5)
    }
  })
})

describe('subsolarLatForSeason', () => {
  it('returns 0 at equinox', () => {
    expect(subsolarLatForSeason('equinox')).toBe(0)
  })
  it('returns +23.44 at June solstice', () => {
    expect(subsolarLatForSeason('june-solstice')).toBeCloseTo(EARTH_TILT_DEG, 5)
  })
  it('returns -23.44 at December solstice', () => {
    expect(subsolarLatForSeason('december-solstice')).toBeCloseTo(-EARTH_TILT_DEG, 5)
  })
})

describe('sunDirection', () => {
  it('returns a unit vector', () => {
    for (const h of [0, 6, 12, 18, 23.9]) {
      const v = sunDirection(h)
      expect(v.length()).toBeCloseTo(1, 5)
    }
  })

  it('points along +X at noon (h=12)', () => {
    const v = sunDirection(12)
    expect(v.x).toBeCloseTo(1, 5)
    expect(v.y).toBeCloseTo(0, 5)
    expect(v.z).toBeCloseTo(0, 5)
  })

  it('matches the subsolar point under latLngToVec3 convention (Earth-local frame)', () => {
    // sunDirection returns the Earth-LOCAL direction to the subsolar point
    // at hour h. sample.ts dots this against an Earth-local point to
    // compute illumination, which works because the dot product is
    // rotation-invariant: same answer whether you express both vectors in
    // local or in world coords. The visual sun in the scene is fixed at
    // world +X (heliocentric model) — that's set in Sun.tsx, not here.
    for (const h of [0, 6, 12, 18]) {
      const [lat, lng] = subsolarPoint(h)
      const fromSubsolar = latLngToVec3(lat, lng, 1)
      const v = sunDirection(h)
      expect(v.x).toBeCloseTo(fromSubsolar.x, 5)
      expect(v.y).toBeCloseTo(fromSubsolar.y, 5)
      expect(v.z).toBeCloseTo(fromSubsolar.z, 5)
    }
  })
})

describe('itczBrightness', () => {
  it('returns a value in [0, 1] for any hour', () => {
    for (const h of [0, 3, 6, 9, 12, 15, 18, 21, 23.999]) {
      const b = itczBrightness(h)
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(1)
    }
  })

  it('peaks at noon', () => {
    expect(itczBrightness(12)).toBeCloseTo(1, 5)
  })

  it('is monotonically increasing from sunrise to noon', () => {
    const samples = [6, 7, 8, 9, 10, 11, 12].map(itczBrightness)
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1] as number)
    }
  })

  it('is monotonically decreasing from noon to sunset', () => {
    const samples = [12, 13, 14, 15, 16, 17, 18].map(itczBrightness)
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1] as number)
    }
  })

  it('is at minimum on the night side', () => {
    expect(itczBrightness(0)).toBeCloseTo(0, 2)
  })
})
