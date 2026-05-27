import { describe, expect, it } from 'vitest'
import { ERAS_BY_ID } from './eras'
import { tweenPlates } from './tweenPlates'

describe('tweenPlates', () => {
  const source = ERAS_BY_ID.pangaea
  const target = ERAS_BY_ID.present

  it('returns source plates verbatim at t=0', () => {
    const out = tweenPlates(source, target, 0)
    expect(out).toHaveLength(source.plates.length)
    for (const tweened of out) {
      const sourcePlate = source.plates.find((p) => p.id === tweened.id)
      expect(sourcePlate).toBeDefined()
      expect(tweened.vertices.length).toBe(sourcePlate?.vertices.length)
      for (let i = 0; i < tweened.vertices.length; i++) {
        const [tlat, tlng] = tweened.vertices[i] as [number, number]
        const [slat, slng] = sourcePlate?.vertices[i] as [number, number]
        expect(tlat).toBeCloseTo(slat, 4)
        expect(tlng).toBeCloseTo(slng, 4)
      }
    }
  })

  it('returns target plates verbatim at t=1', () => {
    const out = tweenPlates(source, target, 1)
    expect(out).toHaveLength(target.plates.length)
    for (const tweened of out) {
      const targetPlate = target.plates.find((p) => p.id === tweened.id)
      expect(targetPlate).toBeDefined()
      expect(tweened.vertices.length).toBe(targetPlate?.vertices.length)
      for (let i = 0; i < tweened.vertices.length; i++) {
        const [tlat, tlng] = tweened.vertices[i] as [number, number]
        const [slat, slng] = targetPlate?.vertices[i] as [number, number]
        expect(tlat).toBeCloseTo(slat, 4)
        expect(tlng).toBeCloseTo(slng, 4)
      }
    }
  })

  it('returns vertices roughly between source and target at t=0.5', () => {
    const out = tweenPlates(source, target, 0.5)
    const pacificTweened = out.find((p) => p.id === 'pacific')
    const pacificSource = source.plates.find((p) => p.id === 'pacific')
    const pacificTarget = target.plates.find((p) => p.id === 'pacific')
    expect(pacificTweened).toBeDefined()
    expect(pacificSource).toBeDefined()
    expect(pacificTarget).toBeDefined()
    if (!pacificTweened || !pacificSource || !pacificTarget) return
    for (let i = 0; i < pacificTweened.vertices.length; i++) {
      const [tlat, _tlng] = pacificTweened.vertices[i] as [number, number]
      const [slat, _slng] = pacificSource.vertices[i] as [number, number]
      const [glat, _glng] = pacificTarget.vertices[i] as [number, number]
      const minLat = Math.min(slat, glat) - 5
      const maxLat = Math.max(slat, glat) + 5
      expect(tlat).toBeGreaterThanOrEqual(minLat)
      expect(tlat).toBeLessThanOrEqual(maxLat)
    }
  })

  it('includes all seven plates in the output', () => {
    const out = tweenPlates(source, target, 0.5)
    const ids = out.map((p) => p.id).sort()
    expect(ids).toEqual(
      [
        'pacific',
        'north-american',
        'eurasian',
        'african',
        'south-american',
        'antarctic',
        'indo-australian',
      ].sort(),
    )
  })
})
