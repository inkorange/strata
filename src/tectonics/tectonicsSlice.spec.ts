import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function freshStore() {
  vi.resetModules()
  const mod = await import('@/src/store')
  return mod.useStore
}

describe('tectonicsSlice', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to currentEraId=present, targetEraId=null, playing=false', async () => {
    const store = await freshStore()
    const state = store.getState()
    expect(state.currentEraId).toBe('present')
    expect(state.targetEraId).toBeNull()
    expect(state.playing).toBe(false)
    expect(state.tweenStartedAt).toBeNull()
  })

  it('setTargetEra updates target + tweenStartedAt', async () => {
    const store = await freshStore()
    store.getState().setTargetEra('pangaea')
    const state = store.getState()
    expect(state.targetEraId).toBe('pangaea')
    expect(state.tweenStartedAt).not.toBeNull()
    expect(state.tweenStartedAt).toBeGreaterThan(0)
  })

  it('setTargetEra is a no-op if the id equals currentEraId and not playing', async () => {
    const store = await freshStore()
    store.getState().setTargetEra('present')
    expect(store.getState().targetEraId).toBeNull()
  })

  it('finishTween commits target to current and clears tween fields', async () => {
    const store = await freshStore()
    store.getState().setTargetEra('pangaea')
    store.getState().finishTween()
    const state = store.getState()
    expect(state.currentEraId).toBe('pangaea')
    expect(state.targetEraId).toBeNull()
    expect(state.tweenStartedAt).toBeNull()
  })

  it('startPlaythrough sets playing=true and advances to the next era', async () => {
    const store = await freshStore()
    // Default is 'present'. Next in ERAS array (after present) is 'future'.
    store.getState().startPlaythrough()
    const state = store.getState()
    expect(state.playing).toBe(true)
    expect(state.targetEraId).toBe('future')
  })

  it('finishTween during playthrough auto-advances to the next era', async () => {
    const store = await freshStore()
    store.getState().startPlaythrough() // target = 'future'
    store.getState().finishTween() // current = 'future', target = next after future
    // After 'future' wraps to 'pangaea' (first era).
    const state = store.getState()
    expect(state.currentEraId).toBe('future')
    expect(state.targetEraId).toBe('pangaea')
    expect(state.playing).toBe(true)
  })

  it('stopPlaythrough sets playing=false but leaves an in-flight tween alone', async () => {
    const store = await freshStore()
    store.getState().setTargetEra('pangaea')
    store.getState().startPlaythrough() // playing=true; tween is to pangaea
    store.getState().stopPlaythrough()
    const state = store.getState()
    expect(state.playing).toBe(false)
    // In-flight tween still resolves.
    expect(state.targetEraId).toBe('pangaea')
  })

  it('finishTween after stopPlaythrough does NOT auto-advance', async () => {
    const store = await freshStore()
    store.getState().startPlaythrough() // playing=true, target=future
    store.getState().stopPlaythrough() // playing=false
    store.getState().finishTween() // commits target, but playing=false so no advance
    const state = store.getState()
    expect(state.currentEraId).toBe('future')
    expect(state.targetEraId).toBeNull()
    expect(state.playing).toBe(false)
  })
})
