import { describe, expect, it } from 'vitest'
import { PRESETS, type Preset } from './presets'

describe('PRESETS', () => {
  it('defines exactly the three tiers', () => {
    expect(Object.keys(PRESETS).sort()).toEqual(
      ['balanced', 'desktop-ultra', 'mobile-lite'].sort(),
    )
  })

  it('desktop-ultra enables every post-fx pass', () => {
    const p: Preset = PRESETS['desktop-ultra']
    expect(p.postFx.bloom).toBe(true)
    expect(p.postFx.ssao).toBe(true)
    expect(p.postFx.dof).toBe(true)
    expect(p.postFx.vignette).toBe(true)
  })

  it('mobile-lite keeps bloom but drops the expensive passes', () => {
    const p = PRESETS['mobile-lite']
    expect(p.postFx.bloom).toBe(true)
    expect(p.postFx.ssao).toBe(false)
    expect(p.postFx.dof).toBe(false)
  })

  it('shadow map size scales by tier', () => {
    expect(PRESETS['desktop-ultra'].shadowMapSize).toBeGreaterThan(
      PRESETS['balanced'].shadowMapSize,
    )
    expect(PRESETS['balanced'].shadowMapSize).toBeGreaterThanOrEqual(
      PRESETS['mobile-lite'].shadowMapSize,
    )
  })

  it('mobile-lite uses demand frameloop; others use always', () => {
    expect(PRESETS['mobile-lite'].frameloop).toBe('demand')
    expect(PRESETS['balanced'].frameloop).toBe('always')
    expect(PRESETS['desktop-ultra'].frameloop).toBe('always')
  })

  it('earth segment counts scale with tier', () => {
    expect(PRESETS['desktop-ultra'].earth.segments).toBeGreaterThan(
      PRESETS['mobile-lite'].earth.segments,
    )
  })

  it('every preset includes a non-empty hdri path', () => {
    for (const tier of ['desktop-ultra', 'balanced', 'mobile-lite'] as const) {
      expect(PRESETS[tier].hdriPath.length).toBeGreaterThan(0)
    }
  })
})
