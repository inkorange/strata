'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { SCENARIOS } from '@/src/systems/carbonModel'
import { DISPLAY_RANGES, degradation, normalizeMass } from '@/src/systems/display'

/** Outer atmosphere glow: a sphere LARGER than the planet, rendered back-side
 *  with additive blending, so the glow lives in the space just outside the
 *  planet's silhouette and fades outward into the void — a corona, not a
 *  surface wrapper. The radial falloff (`pow(c - dot(normal, viewDir), p)`) is
 *  the classic Three.js glow; it has no sun/shadow term, so it stays uniform
 *  around the planet as it rotates. CO2 brightens it (`uIntensity`), spreads it
 *  wider (`uPower` ↓), and hazes its color (`uHaze`). */
const HALO_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldNormal;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(mv.xyz);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * mv;
}
`

const HALO_FRAGMENT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldNormal;
uniform vec3 uColorClean;
uniform vec3 uColorHaze;
uniform vec3 uColorSunset;
uniform vec3 uSunDir;
uniform float uIntensity;
uniform float uPower;
uniform float uHaze;
void main() {
  // Back-side glow. On the visible annulus (the ring of far-hemisphere faces
  // outside the planet's disc) dot(outwardNormal, viewDir) runs ~0.53 at the
  // planet's limb down to 0 at the glow's outer silhouette — so this is
  // brightest where the halo meets the planet and fades OUTWARD into space.
  // The /0.53 normalises the limb to full intensity. (In front of the planet
  // dot→1 but those faces are depth-occluded by the Earth, so no blob shows.)
  float rim = clamp(dot(vNormal, vViewDir), 0.0, 1.0) / 0.45;
  float base = clamp(pow(rim, uPower), 0.0, 1.0);

  // Sun lighting (uSunDir is world-space): the glow is concentrated on the
  // day-facing limb and drops to a faint trace on the night side, so it does
  // NOT glow uniformly all the way around.
  float sunDot = dot(normalize(vWorldNormal), uSunDir);
  float day = smoothstep(-0.15, 0.35, sunDot);
  float night = 1.0 - day;
  float lit = mix(0.1, 1.0, day);

  // Two-tone limb like real airglow: blue scattered light hugging the planet
  // (high rim), a warm band just above it (lower rim), fading to space. The
  // warm band is strongest on the night side and muted in daylight.
  float warm = (1.0 - smoothstep(0.3, 0.72, rim)) * mix(0.15, 1.0, night);
  vec3 color = mix(uColorClean, uColorSunset, warm);
  color = mix(color, uColorHaze, uHaze); // CO2 smog browns the whole band

  gl_FragColor = vec4(color, base * uIntensity * lit);
}
`

/**
 * Mass-driven reservoir visuals for the Earth Systems module. Returns null
 * when another module is active. Two additive overlays read from the store
 * each frame:
 *   - atmosphere halo: a back-side outer glow whose breadth, brightness, and
 *     haze track atmospheric carbon (more CO2 → fatter, brighter, hazier glow)
 *   - interior glow: intensity tracks lithospheric carbon
 * Ocean / biosphere reservoirs are carried by the gauges + carbon-flow
 * particles; their fractional mass change is too small to read as a tint.
 */
export function Reservoirs() {
  const activeModule = useStore((s) => s.activeModule)
  const coreRef = useRef<THREE.Mesh>(null)

  const haloMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: HALO_VERTEX,
        fragmentShader: HALO_FRAGMENT,
        uniforms: {
          uColorClean: { value: new THREE.Color('#8fcaff') }, // blue scatter
          uColorSunset: { value: new THREE.Color('#c66a35') }, // warm airglow band
          uColorHaze: { value: new THREE.Color('#cdbb96') }, // smoggy desaturated
          uSunDir: { value: new THREE.Vector3(1, 0, 0) }, // heliocentric sun at world +X
          uIntensity: { value: 0.6 },
          uPower: { value: 4.5 },
          uHaze: { value: 0 },
        },
        transparent: true,
        side: THREE.BackSide, // glow lives outside the planet silhouette
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  useEffect(() => () => haloMaterial.dispose(), [haloMaterial])

  useFrame(() => {
    const s = useStore.getState()
    const m = s.masses

    // Degradation = atmosphere's rise above the scenario start (0 at day 0),
    // so the band stays a clean translucent blue until carbon accumulates over
    // the years, then densifies, fattens, and hazes toward smog.
    const d = degradation(m.atmosphere, SCENARIOS[s.scenario].masses.atmosphere)
    const u = haloMaterial.uniforms
    u.uIntensity!.value = 0.55 + d * 0.5 // translucent (0.55) → dense (1.05)
    u.uPower!.value = 4.5 - d * 1.3 // tight band (4.5) → fatter (3.2)
    u.uHaze!.value = d // clean blue → smoggy haze as it degrades

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
      {/* Atmosphere halo — back-side outer glow, additive, larger than Earth. */}
      <mesh scale={1.12} material={haloMaterial}>
        <sphereGeometry args={[1, 64, 64]} />
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
