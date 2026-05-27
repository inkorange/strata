'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { HUB_DOLLY, MODULES } from '@/src/shell/modules'
import { useStore } from '@/src/store'

const DURATION_MS = 1100

interface ControlsLike {
  enabled: boolean
  target: THREE.Vector3
  update: () => void
}

/**
 * Tweens the camera position + lookAt (and OrbitControls target) to the
 * active module's dolly target (or HUB_DOLLY when activeModule is 'hub').
 * Eased with smoothstep.
 *
 * During a tween, OrbitControls is disabled so its per-frame update
 * doesn't fight the position lerping. When the tween completes, controls
 * are re-enabled and synced to the camera's final state so user-driven
 * orbit continues from the correct angle.
 */
export function CameraDolly() {
  const activeModule = useStore((s) => s.activeModule)
  const { camera, controls } = useThree() as {
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
    controls: ControlsLike | null
  }

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
    // Use the controls' current target as the start lookAt so user-rotated
    // state is preserved as the source. Falls back to origin if controls
    // aren't mounted yet.
    if (controls?.target) {
      startTargetRef.current.copy(controls.target)
      controls.enabled = false
    } else {
      startTargetRef.current.set(0, 0, 0)
    }

    startTimeRef.current = performance.now()
  }, [activeModule, camera, controls])

  useFrame(() => {
    const start = startTimeRef.current
    if (start === null) return

    const elapsed = performance.now() - start
    const t = Math.min(elapsed / DURATION_MS, 1)
    const eased = t * t * (3 - 2 * t) // smoothstep

    camera.position.lerpVectors(startPosRef.current, endPosRef.current, eased)

    // Tween the controls target alongside the camera; if no controls,
    // just call camera.lookAt with the interpolated target.
    const target = new THREE.Vector3().lerpVectors(
      startTargetRef.current,
      endTargetRef.current,
      eased,
    )
    if (controls?.target) {
      controls.target.copy(target)
    }
    camera.lookAt(target)

    if (t >= 1) {
      startTimeRef.current = null
      if (controls) {
        controls.enabled = true
        controls.update()
      }
    }
  })

  return null
}
