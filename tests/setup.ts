import '@testing-library/jest-dom/vitest'

// happy-dom doesn't ship matchMedia. Many components and our tier detector
// call it on first render — stub a permissive default so tests don't crash.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
