'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { PRESETS } from './presets'
import { AtmosphereRim } from './AtmosphereRim'
import { EarthInterior } from './EarthInterior'
import { useEarthTextures } from './useEarthTextures'

const SURFACE_ROTATION_RATE = 0.02 // rad/sec
const CLOUD_ROTATION_RATE = 0.028  // slightly faster — winds aloft

export function Earth() {
  const effectiveTier = useStore((s) => s.effectiveTier())
  const preset = PRESETS[effectiveTier]
  const textures = useEarthTextures()

  const surfaceRef = useRef<THREE.Mesh>(null)
  const cloudRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (surfaceRef.current) surfaceRef.current.rotation.y += SURFACE_ROTATION_RATE * delta
    if (cloudRef.current) cloudRef.current.rotation.y += CLOUD_ROTATION_RATE * delta
  })

  return (
    <group>
      <EarthInterior />

      {/* Earth surface: PBR material with day + night emissive blend, normal
       * for terrain relief, roughness so oceans are mirror-shiny. */}
      <mesh ref={surfaceRef} castShadow receiveShadow>
        <sphereGeometry args={[1, preset.earth.segments, preset.earth.segments]} />
        <meshStandardMaterial
          map={textures.day}
          normalMap={textures.normal}
          roughnessMap={textures.roughness}
          roughness={1}
          metalness={0.05}
          emissiveMap={textures.night}
          emissive={new THREE.Color('#ffd9a0')}
          emissiveIntensity={1.0}
        />
      </mesh>

      {/* Cloud layer: slightly larger sphere with alpha-from-luminance. */}
      <mesh ref={cloudRef} scale={1.015}>
        <sphereGeometry args={[1, preset.earth.cloudSegments, preset.earth.cloudSegments]} />
        <meshStandardMaterial
          alphaMap={textures.clouds}
          color="#ffffff"
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>

      <AtmosphereRim />
    </group>
  )
}
