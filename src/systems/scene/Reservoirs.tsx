'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { DISPLAY_RANGES, normalizeMass } from '@/src/systems/display'

/**
 * Mass-driven reservoir visuals for the Earth Systems module. Returns null
 * when another module is active. Two additive overlays read from the store
 * each frame:
 *   - atmosphere halo shell: opacity tracks atmospheric carbon
 *   - interior glow: emissive intensity tracks lithospheric carbon
 * Ocean / biosphere reservoirs are carried by the gauges + carbon-flow
 * particles; their fractional mass change is too small to read as a tint.
 */
export function Reservoirs() {
  const activeModule = useStore((s) => s.activeModule)
  const haloRef = useRef<THREE.Mesh>(null)
  const coreRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const m = useStore.getState().masses
    const halo = haloRef.current
    if (halo) {
      const a = normalizeMass(
        m.atmosphere,
        DISPLAY_RANGES.atmosphere[0],
        DISPLAY_RANGES.atmosphere[1],
      )
      const mat = halo.material as THREE.MeshBasicMaterial
      mat.opacity = 0.08 + a * 0.32 // thicker blue rim as CO2 climbs
    }
    const core = coreRef.current
    if (core) {
      const l = normalizeMass(
        m.lithosphere,
        DISPLAY_RANGES.lithosphere[0],
        DISPLAY_RANGES.lithosphere[1],
      )
      const mat = core.material as THREE.MeshBasicMaterial
      mat.opacity = 0.15 + l * 0.35
    }
  })

  if (activeModule !== 'systems') return null

  return (
    <group>
      {/* Atmosphere halo shell — additive, just outside the Earth surface. */}
      <mesh ref={haloRef} scale={1.06}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial
          color="#5cc6ff"
          transparent
          opacity={0.2}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Lithosphere interior glow — additive, just inside the surface. */}
      <mesh ref={coreRef} scale={0.98}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#ff8c5a"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
