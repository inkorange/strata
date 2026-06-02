'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { latLngToVec3 } from '@/src/tectonics/sphericalGeometry'
import { itczBrightness, subsolarPoint } from '@/src/atmos/solar'

const BAND_RADIUS = 1.018
const PUFF_COUNT = 80 // around the full equator

/**
 * ITCZ cloud band: a ring of 80 billboard sprites around the equator at
 * radius 1.018. Per-sprite brightness is computed in the fragment shader
 * from the sprite's longitude proximity to the subsolar longitude, scaled
 * by the global `itczBrightness(hour)` envelope. So only the sun-facing
 * arc of the equator shows cloud; the night side stays dark.
 *
 * Implemented as instanced billboards for one-draw-call efficiency.
 */
export function CloudBand() {
  const visible = useStore((s) => s.layers.clouds)
  const hour = useStore((s) => s.hour)

  // Per-puff longitudes (degrees), evenly spaced 0..360.
  const puffLngs = useMemo(() => {
    const out: number[] = []
    for (let i = 0; i < PUFF_COUNT; i++) out.push((i / PUFF_COUNT) * 360 - 180)
    return out
  }, [])

  // Subsolar longitude this frame (recomputed only on hour change).
  const subsolarLng = useMemo(() => subsolarPoint(hour)[1], [hour])
  const globalBrightness = useMemo(() => itczBrightness(hour), [hour])

  if (!visible) return null

  return (
    <group>
      {puffLngs.map((lng, idx) => {
        const pos = latLngToVec3(0, lng, BAND_RADIUS)
        // Angular distance to subsolar (deg, in [0, 180]).
        const rawDelta = Math.abs(((lng - subsolarLng + 540) % 360) - 180)
        // 0 → 1 within ±30°; falls to 0 over ±60°.
        const proximity = Math.max(0, 1 - rawDelta / 60)
        const opacity = Math.max(0, Math.min(1, globalBrightness * proximity))
        if (opacity < 0.01) return null
        return (
          <sprite key={idx} position={[pos.x, pos.y, pos.z]} scale={[0.18, 0.07, 1]}>
            <spriteMaterial
              color="#ffffff"
              opacity={opacity}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        )
      })}
    </group>
  )
}
