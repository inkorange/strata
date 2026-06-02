'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { sunDirection } from '@/src/atmos/solar'
import { useStore } from '@/src/store'

const SUN_DISTANCE = 8 // far enough to read as distant; clears the camera dolly range

/**
 * Visible sun for the Atmosphere module: a directional light + an emissive
 * sphere sprite. Position is driven entirely by the store's `hour` —
 * sunDirection() returns the unit vector from origin to sun, which we scale
 * to SUN_DISTANCE for world position.
 *
 * The directional light's target stays at origin so Earth is always lit
 * from the sun's actual direction. Sprite uses additive blending so it
 * composites cleanly against the dark starfield without a hard disc edge.
 */
export function Sun() {
  const hour = useStore((s) => s.hour)

  const position = useMemo<[number, number, number]>(() => {
    const dir = sunDirection(hour)
    return [dir.x * SUN_DISTANCE, dir.y * SUN_DISTANCE, dir.z * SUN_DISTANCE]
  }, [hour])

  return (
    <group>
      <directionalLight position={position} intensity={2.4} color="#fff4d6" />
      <mesh position={position}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshBasicMaterial
          color="#ffe6a8"
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
