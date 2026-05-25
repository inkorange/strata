'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { HUB_DOLLY, MODULES } from '@/src/shell/modules'
import { useStore } from '@/src/store'

const DURATION_MS = 1100

/**
 * Tweens the camera position + lookAt to the active module's dolly target
 * (or HUB_DOLLY when activeModule is 'hub'). Eased with smoothstep.
 *
 * Mount inside the Canvas. Reads activeModule from the store; whenever
 * it changes, it captures the current camera state as the tween source
 * and runs for DURATION_MS.
 */
export function CameraDolly() {
  const activeModule = useStore((s) => s.activeModule)
  const { camera } = useThree()

  const startTimeRef = useRef<number | null>(null)
  const startPosRef = useRef(new THREE.Vector3())
  const startTargetRef = useRef(new THREE.Vector3())
  const endPosRef = useRef(new THREE.Vector3())
  const endTargetRef = useRef(new THREE.Vector3())

  // Resolve the target dolly for the current active module.
  useEffect(() => {
    const dolly = activeModule === 'hub' ? HUB_DOLLY : MODULES[activeModule].dolly
    endPosRef.current.set(...dolly.position)
    endTargetRef.current.set(...dolly.lookAt)

    startPosRef.current.copy(camera.position)
    // Current lookAt point: camera direction projected forward. Using the
    // origin as a stand-in works because OrbitControls always targets it.
    startTargetRef.current.set(0, 0, 0)

    startTimeRef.current = performance.now()
  }, [activeModule, camera])

  useFrame(() => {
    const start = startTimeRef.current
    if (start === null) return

    const elapsed = performance.now() - start
    const t = Math.min(elapsed / DURATION_MS, 1)
    const eased = t * t * (3 - 2 * t) // smoothstep

    camera.position.lerpVectors(startPosRef.current, endPosRef.current, eased)
    const target = new THREE.Vector3().lerpVectors(
      startTargetRef.current,
      endTargetRef.current,
      eased,
    )
    camera.lookAt(target)

    if (t >= 1) startTimeRef.current = null
  })

  return null
}
