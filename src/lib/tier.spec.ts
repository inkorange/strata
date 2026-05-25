import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectTier } from './tier'

type NavLike = Partial<Navigator> & {
  deviceMemory?: number
  hardwareConcurrency?: number
}

function mockNavigator(overrides: NavLike) {
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    ...overrides,
  })
}

function mockPointer(coarse: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(pointer: coarse)' ? coarse : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }))
}

describe('detectTier', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns mobile-lite when pointer is coarse (touch)', () => {
    mockPointer(true)
    mockNavigator({ hardwareConcurrency: 8, deviceMemory: 8 })
    expect(detectTier()).toBe('mobile-lite')
  })

  it('returns desktop-ultra when fine pointer + 8+ cores + 8+ GB', () => {
    mockPointer(false)
    mockNavigator({ hardwareConcurrency: 8, deviceMemory: 8 })
    expect(detectTier()).toBe('desktop-ultra')
  })

  it('returns balanced when fine pointer but modest specs', () => {
    mockPointer(false)
    mockNavigator({ hardwareConcurrency: 4, deviceMemory: 4 })
    expect(detectTier()).toBe('balanced')
  })

  it('returns balanced when deviceMemory is missing but cores look ok', () => {
    mockPointer(false)
    mockNavigator({ hardwareConcurrency: 8 })
    expect(detectTier()).toBe('balanced')
  })

  it('falls back to balanced in SSR-shaped env (no window globals)', () => {
    // Simulate the path where matchMedia is undefined entirely
    vi.stubGlobal('matchMedia', undefined)
    mockNavigator({})
    expect(detectTier()).toBe('balanced')
  })
})
