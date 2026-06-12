'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { usePrefersReducedMotion } from '@/src/lib/accessibility'
import { useStore } from '@/src/store'

/** Particle counts per tier. */
const COUNT_BY_TIER: Record<string, number> = {
  'desktop-ultra': 600,
  balanced: 300,
  'mobile-lite': 120,
}

/**
 * Carbon as glowing instanced points flowing radially between the Earth
 * interior and the atmosphere halo. Each particle rides outward from radius
 * ~0.6 to ~1.15 on a fixed random direction, looping. Flow speed scales with
 * the current human forcing (fossil + |land| levers) so a heavy-emissions run
 * visibly surges. Returns null when the module is inactive; particles freeze
 * under prefers-reduced-motion.
 */
export function CarbonFlows() {
  const activeModule = useStore((s) => s.activeModule)
  const effectiveTier = useStore((s) => s.effectiveTier())
  const reduced = usePrefersReducedMotion()
  const pointsRef = useRef<THREE.Points>(null)

  const count = COUNT_BY_TIER[effectiveTier] ?? 300

  // Fixed per-particle direction + phase, regenerated only when count changes.
  const { geometry, dirs, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3)
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
    return { geometry, dirs, phases }
  }, [count])

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#fff2cc',
        size: 0.02,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )

  const tRef = useRef(0)
  useFrame((_, delta) => {
    const pts = pointsRef.current
    if (!pts) return
    const s = useStore.getState()
    const forcing = s.fossilLever + Math.abs(s.landLever) // 0..2
    if (!reduced) tRef.current += delta * (0.05 + forcing * 0.12)
    const pos = (pts.geometry.getAttribute('position') as THREE.BufferAttribute)
      .array as Float32Array
    const R_IN = 0.6
    const R_OUT = 1.15
    for (let i = 0; i < count; i++) {
      const f = (phases[i]! + tRef.current) % 1
      const r = R_IN + f * (R_OUT - R_IN)
      const d = dirs[i]!
      pos[i * 3] = d.x * r
      pos[i * 3 + 1] = d.y * r
      pos[i * 3 + 2] = d.z * r
    }
    ;(pts.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
  })

  if (activeModule !== 'systems') return null

  return <points ref={pointsRef} geometry={geometry} material={material} />
}
