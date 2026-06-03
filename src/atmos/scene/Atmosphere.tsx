'use client'

import { useStore } from '@/src/store'
import { Cells } from './Cells'
import { Heatmap } from './Heatmap'
import { HoverInspector } from './HoverInspector'

/**
 * Atmosphere module's surface-anchored layers. Returns null when another
 * module is active so it costs nothing on /, /tectonics, or /systems.
 *
 * Mounted inside PersistentScene's tilted + SPINNING earth frame, so its
 * meshes track Earth's rotation (the geographic temperature gradient
 * and the wind belts rotate with Earth, as they would in reality).
 *
 * <Sun /> and <CloudBand /> deliberately live elsewhere:
 *   - Sun:        outside the tilt frame entirely (celestial, world-space).
 *   - CloudBand:  inside the tilt frame but OUTSIDE the spin frame, so its
 *                 hour-driven per-puff brightness stays aligned with the
 *                 fixed sun position rather than rotating off into the
 *                 night side as Earth spins.
 */
export function Atmosphere() {
  const activeModule = useStore((s) => s.activeModule)
  if (activeModule !== 'atmosphere') return null

  return (
    <group>
      <Heatmap />
      <Cells />
      <HoverInspector />
    </group>
  )
}
