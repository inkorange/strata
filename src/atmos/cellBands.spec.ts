import { describe, expect, it } from 'vitest'
import { CELL_BANDS, allArrowArcs, arrowArcPoints } from './cellBands'

describe('CELL_BANDS', () => {
  it('has exactly 6 bands (2 polar, 2 westerly, 2 trade)', () => {
    expect(CELL_BANDS).toHaveLength(6)
    const ids = CELL_BANDS.map((b) => b.id).sort()
    expect(ids).toEqual([
      'polar-n',
      'polar-s',
      'trade-n',
      'trade-s',
      'westerly-n',
      'westerly-s',
    ])
  })

  it('places bands at the documented latitudes', () => {
    const byId = Object.fromEntries(CELL_BANDS.map((b) => [b.id, b]))
    expect(byId['polar-n']?.latDeg).toBe(75)
    expect(byId['polar-s']?.latDeg).toBe(-75)
    expect(byId['westerly-n']?.latDeg).toBe(45)
    expect(byId['westerly-s']?.latDeg).toBe(-45)
    expect(byId['trade-n']?.latDeg).toBe(15)
    expect(byId['trade-s']?.latDeg).toBe(-15)
  })

  it('uses the documented ring densities per belt type', () => {
    const byBelt = (belt: string) => CELL_BANDS.filter((b) => b.belt === belt)
    expect(byBelt('polar').every((b) => b.arrowsAroundRing === 4)).toBe(true)
    expect(byBelt('westerly').every((b) => b.arrowsAroundRing === 6)).toBe(true)
    expect(byBelt('trade').every((b) => b.arrowsAroundRing === 8)).toBe(true)
  })
})

describe('arrowArcPoints', () => {
  it('returns at least 4 points so a TubeGeometry can be built', () => {
    const band = CELL_BANDS.find((b) => b.id === 'trade-n')!
    const points = arrowArcPoints(band, 0, band.arrowsAroundRing, 8)
    expect(points.length).toBeGreaterThanOrEqual(4)
  })

  it('places every point on the unit sphere (within float tolerance)', () => {
    for (const band of CELL_BANDS) {
      const points = arrowArcPoints(band, 0, band.arrowsAroundRing, 8)
      for (const p of points) {
        expect(p.length()).toBeCloseTo(1, 4)
      }
    }
  })

  it('places successive arrows around the latitude ring at evenly spaced longitudes', () => {
    const band = CELL_BANDS.find((b) => b.id === 'trade-n')!
    const p0 = arrowArcPoints(band, 0, band.arrowsAroundRing, 8)[0]!
    const p1 = arrowArcPoints(band, 1, band.arrowsAroundRing, 8)[0]!
    const lng0 = (Math.atan2(-p0.z, p0.x) * 180) / Math.PI
    const lng1 = (Math.atan2(-p1.z, p1.x) * 180) / Math.PI
    const expectedSpacing = 360 / band.arrowsAroundRing
    const actualSpacing = ((lng1 - lng0 + 540) % 360) - 180
    expect(Math.abs(actualSpacing)).toBeCloseTo(expectedSpacing, 1)
  })

  it('curves trade-wind arrows toward the equator', () => {
    const band = CELL_BANDS.find((b) => b.id === 'trade-n')!
    const points = arrowArcPoints(band, 0, band.arrowsAroundRing, 8)
    const startLat = (Math.asin(points[0]!.y) * 180) / Math.PI
    const endLat = (Math.asin(points[points.length - 1]!.y) * 180) / Math.PI
    expect(startLat).toBeGreaterThan(endLat)
  })
})

describe('allArrowArcs', () => {
  it('returns one entry per arrow across all bands (8+6+4 per hemisphere × 2 hemispheres = 36)', () => {
    const arcs = allArrowArcs()
    const totalArrows = CELL_BANDS.reduce((sum, b) => sum + b.arrowsAroundRing, 0)
    expect(arcs).toHaveLength(totalArrows)
  })

  it('tags each arc with its band and longitudeIndex', () => {
    const arcs = allArrowArcs()
    for (const a of arcs) {
      expect(CELL_BANDS).toContain(a.band)
      expect(a.longitudeIndex).toBeGreaterThanOrEqual(0)
      expect(a.longitudeIndex).toBeLessThan(a.band.arrowsAroundRing)
      expect(a.points.length).toBeGreaterThanOrEqual(4)
    }
  })
})
