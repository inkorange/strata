'use client'

import { useEffect, useState } from 'react'

/** Fallback when running during SSR (no window object). 16:9 is a sensible
 *  desktop default; the hook re-syncs after hydration. */
const SSR_DEFAULT_ASPECT = 16 / 9

/**
 * Camera distance from origin such that a unit-radius sphere centered at
 * origin fills exactly `fillRatio` of the SMALLER viewport dimension.
 *
 * The smaller dimension changes with aspect ratio: on wide viewports
 * (16:9 desktop) the height is the limiting dimension; on tall viewports
 * (phone portrait) the width is. Fitting the smaller dimension ensures the
 * sphere always fits ON SCREEN without overflowing the other axis.
 *
 * Derivation: at distance d and vertical FOV `fovDeg`, visible height is
 * `2 * d * tan(fovDeg/2)` and visible width is `aspect` times that. A
 * unit sphere occupies 2 world-space units in screen-aligned dimensions.
 *
 *   - aspect ≥ 1 (wide): fit height → d = 1 / (fillRatio * tan(fov/2))
 *   - aspect <  1 (tall): fit width  → d = 1 / (fillRatio * aspect * tan(fov/2))
 */
export function getEarthFillDistance(
  fillRatio: number,
  aspect: number,
  fovDeg: number,
): number {
  const tanHalfFov = Math.tan(((fovDeg * Math.PI) / 180) / 2)
  if (aspect >= 1) return 1 / (fillRatio * tanHalfFov)
  return 1 / (fillRatio * aspect * tanHalfFov)
}

/**
 * Reactive viewport aspect ratio (width / height). Re-syncs on every
 * `resize` event. SSR-safe — returns a sensible default before hydration.
 */
export function useViewportAspect(): number {
  const [aspect, setAspect] = useState<number>(() => {
    if (typeof window === 'undefined') return SSR_DEFAULT_ASPECT
    return window.innerWidth / window.innerHeight
  })

  useEffect(() => {
    const update = () => setAspect(window.innerWidth / window.innerHeight)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return aspect
}
