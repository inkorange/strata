import { describe, expect, it } from 'vitest'
import { ERAS_BY_ID } from './eras'
import { landLayers } from './landLayers'

describe('landLayers', () => {
  it('at rest (no target) returns one full-opacity layer of the current era', () => {
    const layers = landLayers('present', null, 0)
    expect(layers).toHaveLength(1)
    expect(layers[0]!.opacity).toBe(1)
    expect(layers[0]!.polygons).toBe(ERAS_BY_ID.present.land)
  })

  it('mid-transition returns source fading out + target fading in (opacities sum to 1)', () => {
    const layers = landLayers('present', 'eocene', 0.25)
    expect(layers).toHaveLength(2)
    const [src, tgt] = layers
    expect(src!.polygons).toBe(ERAS_BY_ID.present.land)
    expect(tgt!.polygons).toBe(ERAS_BY_ID.eocene.land)
    expect(src!.opacity).toBeCloseTo(0.75, 6)
    expect(tgt!.opacity).toBeCloseTo(0.25, 6)
  })

  it('at t>=1 the target is fully opaque', () => {
    const layers = landLayers('present', 'eocene', 1)
    expect(layers.find((l) => l.polygons === ERAS_BY_ID.eocene.land)!.opacity).toBe(1)
  })
})
