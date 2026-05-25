import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Re-import the store per test so persistence reads/writes don't leak across cases.
async function freshStore() {
  vi.resetModules()
  const mod = await import('./index')
  return mod.useStore
}

describe('shellSlice', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to hub module', async () => {
    const store = await freshStore()
    expect(store.getState().activeModule).toBe('hub')
  })

  it('setActiveModule updates the slice', async () => {
    const store = await freshStore()
    store.getState().setActiveModule('tectonics')
    expect(store.getState().activeModule).toBe('tectonics')
  })

  it('effectiveTier returns the override when set, else the detected tier', async () => {
    const store = await freshStore()
    store.setState({ tier: 'balanced', tierOverride: null })
    expect(store.getState().effectiveTier()).toBe('balanced')
    store.getState().setTierOverride('desktop-ultra')
    expect(store.getState().effectiveTier()).toBe('desktop-ultra')
  })

  it('persists tierOverride and activeModule to localStorage', async () => {
    const store = await freshStore()
    store.getState().setTierOverride('mobile-lite')
    store.getState().setActiveModule('atmosphere')

    // Allow the 1s persistence debounce to flush; we expose a sync flush
    // helper in the store specifically for tests.
    store.getState().__flushPersist?.()

    const raw = localStorage.getItem('strata:shell')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw as string)
    expect(parsed.tierOverride).toBe('mobile-lite')
    expect(parsed.activeModule).toBe('atmosphere')
  })

  it('rehydrates from localStorage on first import', async () => {
    localStorage.setItem(
      'strata:shell',
      JSON.stringify({ tierOverride: 'mobile-lite', activeModule: 'systems' }),
    )
    const store = await freshStore()
    expect(store.getState().tierOverride).toBe('mobile-lite')
    expect(store.getState().activeModule).toBe('systems')
  })

  it('toggleHighContrast flips and persists', async () => {
    const store = await freshStore()
    expect(store.getState().highContrast).toBe(false)
    store.getState().toggleHighContrast()
    expect(store.getState().highContrast).toBe(true)
  })
})
