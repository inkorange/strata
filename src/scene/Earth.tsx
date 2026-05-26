'use client'

import * as THREE from 'three'
import { useStore } from '@/src/store'
import { EarthInterior } from './EarthInterior'
import { PRESETS } from './presets'
import { useEarthTextures } from './useEarthTextures'

// import { AtmosphereRim } from './AtmosphereRim'
// AtmosphereRim is deferred to a follow-up PR. The fresnel-based shader
// produced color bleed across the visible disc that was hard to tune
// without flicker. The component file in ./AtmosphereRim.tsx is kept
// intact so the eventual fix can re-enable it without re-implementing.

export function Earth() {
  const effectiveTier = useStore((s) => s.effectiveTier())
  const preset = PRESETS[effectiveTier]
  const textures = useEarthTextures()

  return (
    <group>
      <EarthInterior />

      {/* Earth surface: PBR material with day + night emissive blend, normal
       * for terrain relief, roughness so oceans are mirror-shiny. */}
      <mesh>
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
      <mesh scale={1.015}>
        <sphereGeometry args={[1, preset.earth.cloudSegments, preset.earth.cloudSegments]} />
        <meshStandardMaterial
          alphaMap={textures.clouds}
          color="#ffffff"
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>

      {/* <AtmosphereRim /> deferred per the import comment above */}
    </group>
  )
}
