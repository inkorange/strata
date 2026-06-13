'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { usePrefersReducedMotion } from '@/src/lib/accessibility'
import { useStore } from '@/src/store'

/** Particle counts per tier. */
const COUNT_BY_TIER: Record<string, number> = {
  'desktop-ultra': 600,
  balanced: 300,
  'mobile-lite': 120,
}

const R_IN = 0.6
const R_OUT = 1.15
/** Peak per-particle alpha (before the soft round-sprite falloff). */
const PEAK_ALPHA = 0.85

/** Soft round sprite + per-particle alpha so each mote fades in as it leaves
 *  the interior and fades out approaching the halo — no hard pop at either end. */
const vertexShader = /* glsl */ `
attribute float alpha;
varying float vAlpha;
uniform float uSize;
void main() {
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const fragmentShader = /* glsl */ `
precision mediump float;
varying float vAlpha;
uniform vec3 uColor;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  float soft = smoothstep(0.5, 0.0, d); // round, soft-edged sprite
  gl_FragColor = vec4(uColor, vAlpha * soft);
}
`

/** Smoothstep helper (matches GLSL smoothstep) for the JS-side travel fade. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Carbon as glowing points flowing radially between the Earth interior and the
 * atmosphere halo. Each particle rides outward from radius ~0.6 to ~1.15 on a
 * fixed random direction, looping, and fades in near the interior / out near
 * the halo for a smooth continuous stream. Flow speed scales with the current
 * human forcing (fossil + |land| levers) so a heavy-emissions run visibly
 * surges. Returns null when the module is inactive; particles freeze under
 * prefers-reduced-motion.
 */
export function CarbonFlows() {
  const activeModule = useStore((s) => s.activeModule)
  const effectiveTier = useStore((s) => s.effectiveTier())
  const reduced = usePrefersReducedMotion()
  const pointsRef = useRef<THREE.Points>(null)

  const count = COUNT_BY_TIER[effectiveTier] ?? 300

  // Fixed per-particle direction + phase; regenerated only when count changes.
  const { geometry, dirs, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const alphas = new Float32Array(count)
    const dirs: THREE.Vector3[] = []
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ).normalize()
      dirs.push(v)
      phases[i] = (i / count) % 1
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))
    return { geometry, dirs, phases }
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uColor: { value: new THREE.Color('#ffd9a0') },
          uSize: { value: 26 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )

  // Free GPU buffers when count (and thus geometry) changes or on unmount.
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  const tRef = useRef(0)
  useFrame((_, delta) => {
    const pts = pointsRef.current
    if (!pts) return
    const s = useStore.getState()
    const forcing = s.fossilLever + Math.abs(s.landLever) // 0..2
    if (!reduced) tRef.current += delta * (0.05 + forcing * 0.12)

    const posAttr = pts.geometry.getAttribute('position') as THREE.BufferAttribute
    const alphaAttr = pts.geometry.getAttribute('alpha') as THREE.BufferAttribute
    const pos = posAttr.array as Float32Array
    const alpha = alphaAttr.array as Float32Array

    for (let i = 0; i < count; i++) {
      const f = (phases[i]! + tRef.current) % 1
      const r = R_IN + f * (R_OUT - R_IN)
      const d = dirs[i]!
      pos[i * 3] = d.x * r
      pos[i * 3 + 1] = d.y * r
      pos[i * 3 + 2] = d.z * r
      // Fade in over the first ~18% of travel, fade out over the last ~18%.
      alpha[i] = PEAK_ALPHA * smoothstep(0, 0.18, f) * smoothstep(1, 0.82, f)
    }
    posAttr.needsUpdate = true
    alphaAttr.needsUpdate = true
  })

  if (activeModule !== 'systems') return null

  return <points ref={pointsRef} geometry={geometry} material={material} />
}
