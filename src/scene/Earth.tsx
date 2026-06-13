'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { SCENARIOS } from '@/src/systems/carbonModel'
import { degradation } from '@/src/systems/display'
import { EarthInterior } from './EarthInterior'
import { PRESETS } from './presets'
import { useEarthTextures } from './useEarthTextures'

// import { AtmosphereRim } from './AtmosphereRim'
// AtmosphereRim is deferred to a follow-up PR. The fresnel-based shader
// produced color bleed across the visible disc that was hard to tune
// without flicker. The component file in ./AtmosphereRim.tsx is kept
// intact so the eventual fix can re-enable it without re-implementing.

// Hoisted outside the component so re-renders don't allocate a new
// THREE.Color instance for the emissive prop. R3F's reconciler treats a
// fresh Color instance as a property change and updates the material,
// which on some browsers triggers a brief recompile / flash — most
// visible during a window-resize storm of layout-driven re-renders.
const NIGHT_EMISSIVE_COLOR = new THREE.Color('#ffd9a0')

// Surface tint endpoints for the Earth Systems "dying planet" effect: a healthy
// planet multiplies its texture by white (no change); a fully degraded one
// multiplies by a dry, desaturated brown so seas go murky and land goes dead.
const HEALTHY_TINT = new THREE.Color('#ffffff')
const DEAD_TINT = new THREE.Color('#7d5a2e')

// Cloud tint endpoints: clean white clouds → dirty smog-gray as carbon climbs.
const CLOUD_CLEAN = new THREE.Color('#ffffff')
const CLOUD_SMOG = new THREE.Color('#9a9082')

// Extra overcast cloud decks: copies of the base cloud texture on slightly
// larger spheres, each rotated to a different position so the patterns don't
// overlap. They fade in at staggered degradation thresholds, so as pollution
// worsens the planet gathers progressively heavier, messier cloud cover. Clean
// overcast white shifting to smog-gray at the extreme.
const OVERCAST_COLOR = new THREE.Color('#bdb7ab')
const OVERCAST_MAX_OPACITY = 0.9
const OVERCAST_DECKS: {
  scale: number
  rotation: [number, number, number]
  fadeLo: number
  fadeHi: number
}[] = [
  { scale: 1.02, rotation: [0.4, 2.1, 0], fadeLo: 0.12, fadeHi: 0.4 },
  { scale: 1.024, rotation: [-0.6, 4.0, 0.3], fadeLo: 0.35, fadeHi: 0.65 },
  { scale: 1.028, rotation: [0.9, 0.7, -0.4], fadeLo: 0.6, fadeHi: 0.9 },
]

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function Earth() {
  const effectiveTier = useStore((s) => s.effectiveTier())
  const preset = PRESETS[effectiveTier]
  const textures = useEarthTextures()
  const activeModule = useStore((s) => s.activeModule)
  const showEarthSurface = activeModule !== 'tectonics'
  const surfaceMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const cloudMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const overcastRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([])

  // In the Earth Systems module, degrade the planet as atmospheric carbon
  // climbs: the surface tints toward a dead brown, the base clouds dirty toward
  // smog-gray, and extra overcast decks fade in to thicken the cover. Elsewhere
  // everything is held at pristine values so the photoreal Earth is untouched.
  // Driven per-frame from live masses so it tracks playback + scrubbing.
  useFrame(() => {
    const surface = surfaceMatRef.current
    const cloud = cloudMatRef.current
    const decks = overcastRefs.current
    if (activeModule === 'systems') {
      const st = useStore.getState()
      const baseline = SCENARIOS[st.scenario].masses.atmosphere
      const d = degradation(st.masses.atmosphere, baseline)
      if (surface) surface.color.lerpColors(HEALTHY_TINT, DEAD_TINT, d)
      if (cloud) {
        cloud.color.lerpColors(CLOUD_CLEAN, CLOUD_SMOG, d)
        cloud.opacity = 0.85 + d * 0.15
      }
      for (let i = 0; i < OVERCAST_DECKS.length; i++) {
        const mat = decks[i]
        if (!mat) continue
        const deck = OVERCAST_DECKS[i]
        if (!deck) continue
        mat.opacity = smoothstep(deck.fadeLo, deck.fadeHi, d) * OVERCAST_MAX_OPACITY
        mat.color.lerpColors(OVERCAST_COLOR, CLOUD_SMOG, d)
      }
    } else {
      if (surface && !surface.color.equals(HEALTHY_TINT)) surface.color.copy(HEALTHY_TINT)
      if (cloud) {
        if (!cloud.color.equals(CLOUD_CLEAN)) cloud.color.copy(CLOUD_CLEAN)
        cloud.opacity = activeModule === 'tectonics' ? 0.55 : 0.85
      }
      for (const mat of decks) {
        if (mat) mat.opacity = 0
      }
    }
  })

  return (
    <group>
      <EarthInterior />

      {/* Earth surface: PBR material with day + night emissive blend, normal
       * for terrain relief, roughness so oceans are mirror-shiny. */}
      <mesh visible={showEarthSurface}>
        <sphereGeometry args={[1, preset.earth.segments, preset.earth.segments]} />
        <meshStandardMaterial
          ref={surfaceMatRef}
          map={textures.day}
          normalMap={textures.normal}
          roughnessMap={textures.roughness}
          roughness={1}
          metalness={0.05}
          emissiveMap={textures.night}
          emissive={NIGHT_EMISSIVE_COLOR}
          emissiveIntensity={1.0}
        />
      </mesh>

      {/* Cloud layer: slightly larger sphere with alpha-from-luminance.
       * Stays visible in tectonics mode for atmospheric realism — clouds
       * don't carry continent shapes, so they don't conflict with the
       * paleogeographic polygons rendered on top. */}
      <mesh scale={1.015}>
        <sphereGeometry args={[1, preset.earth.cloudSegments, preset.earth.cloudSegments]} />
        <meshStandardMaterial
          ref={cloudMatRef}
          alphaMap={textures.clouds}
          color="#ffffff"
          transparent
          opacity={activeModule === 'tectonics' ? 0.55 : 0.85}
          depthWrite={false}
        />
      </mesh>

      {/* Extra overcast cloud decks (Earth Systems pollution). Always mounted
       * but transparent until carbon climbs; each is offset so the cover
       * compounds instead of overlapping. */}
      {OVERCAST_DECKS.map((deck, i) => (
        <mesh key={`overcast-${deck.scale}`} scale={deck.scale} rotation={deck.rotation}>
          <sphereGeometry args={[1, preset.earth.cloudSegments, preset.earth.cloudSegments]} />
          <meshStandardMaterial
            ref={(el) => {
              overcastRefs.current[i] = el
            }}
            alphaMap={textures.clouds}
            color="#bdb7ab"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* <AtmosphereRim /> deferred per the import comment above */}
    </group>
  )
}
