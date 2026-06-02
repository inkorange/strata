'use client'

import { useStore } from '@/src/store'

/**
 * Atmosphere module scene root. Composes the sun, surface temperature
 * heatmap, convection-cell arrows, ITCZ cloud band, and hover inspector.
 * Returns null when another module is active so it costs nothing on /,
 * /tectonics, or /systems routes.
 */
export function Atmosphere() {
  const activeModule = useStore((s) => s.activeModule)
  if (activeModule !== 'atmosphere') return null

  // Sub-meshes are added in subsequent tasks (Sun, Heatmap, Cells, CloudBand,
  // HoverInspector). Render an empty group placeholder for now so PersistentScene
  // can mount this component immediately without conditional wiring.
  return <group />
}
