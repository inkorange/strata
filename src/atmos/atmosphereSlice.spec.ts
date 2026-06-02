import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function freshStore() {
  vi.resetModules()
  const mod = await import('@/src/store')
  return mod.useStore
}

describe('atmosphereSlice', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults: hour=12, all layers on, inspectAt=null', async () => {
    const store = await freshStore()
    const state = store.getState()
    expect(state.hour).toBe(12)
    expect(state.layers).toEqual({ cells: true, temp: true, clouds: true })
    expect(state.inspectAt).toBeNull()
  })

  it('setHour clamps to [0, 24)', async () => {
    const store = await freshStore()
    store.getState().setHour(-3)
    expect(store.getState().hour).toBe(0)
    store.getState().setHour(24)
    expect(store.getState().hour).toBeLessThan(24)
    expect(store.getState().hour).toBeGreaterThanOrEqual(23.999)
    store.getState().setHour(14.5)
    expect(store.getState().hour).toBe(14.5)
  })

  it('toggleLayer flips just that layer', async () => {
    const store = await freshStore()
    store.getState().toggleLayer('cells')
    expect(store.getState().layers).toEqual({ cells: false, temp: true, clouds: true })
    store.getState().toggleLayer('temp')
    expect(store.getState().layers).toEqual({ cells: false, temp: false, clouds: true })
    store.getState().toggleLayer('cells')
    expect(store.getState().layers).toEqual({ cells: true, temp: false, clouds: true })
  })

  it('setInspectAt accepts a point and round-trips to null', async () => {
    const store = await freshStore()
    store.getState().setInspectAt([40, -90])
    expect(store.getState().inspectAt).toEqual([40, -90])
    store.getState().setInspectAt(null)
    expect(store.getState().inspectAt).toBeNull()
  })
})
