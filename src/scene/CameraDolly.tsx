'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { MODULES } from '@/src/shell/modules'
import { useStore } from '@/src/store'
import { getEarthFillDistance, useViewportAspect } from './cameraFit'

const DURATION_MS = 1100

/** Vertical FOV matches the camera config in Scene.tsx. */
const CAMERA_FOV_DEG = 45

/** Fraction of the smaller viewport dimension Earth should fill on the hub. */
const HUB_FILL_RATIO = 0.8

/**
 * Resolve a direction vector + fill ratio into a world-space camera
 * position that frames the Earth at the right size for the current
 * viewport. Direction magnitude is irrelevant — only the unit vector
 * matters; distance comes from getEarthFillDistance.
 */
function positionFromDirection(
  direction: [number, number, number],
  fillRatio: number,
  aspect: number,
): [number, number, number] {
  const [x, y, z] = direction
  const mag = Math.hypot(x, y, z) || 1
  const dist = getEarthFillDistance(fillRatio, aspect, CAMERA_FOV_DEG)
  return [(x / mag) * dist, (y / mag) * dist, (z / mag) * dist]
}

interface ControlsLike {
  enabled: boolean
  target: THREE.Vector3
  update: () => void
}

/**
 * Tweens the camera position + lookAt (and OrbitControls target) to the
 * active module's dolly target. The hub target is computed from the live
 * viewport aspect so the Earth always fills HUB_FILL_RATIO (0.8) of the
 * viewport width — on a wide desktop the camera sits close, on a narrow
 * phone in portrait it pulls back so the sphere doesn't overflow.
 *
 * Module changes trigger a smoothstep-eased tween. Aspect-only changes
 * (window resize while staying on the hub) snap the camera directly to
 * the new target without animation, so a continuous resize doesn't
 * produce a jittery permanent-tweening effect.
 *
 * During a tween, OrbitControls is disabled so its per-frame update
 * doesn't fight the position lerping. When the tween completes, controls
 * are re-enabled and synced to the camera's final state so user-driven
 * orbit continues from the correct angle.
 */
export function CameraDolly() {
  const activeModule = useStore((s) => s.activeModule)
  const aspect = useViewportAspect()
  const { camera, controls } = useThree() as {
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
    controls: ControlsLike | null
  }

  const startTimeRef = useRef<number | null>(null)
  const startPosRef = useRef(new THREE.Vector3())
  const startTargetRef = useRef(new THREE.Vector3())
  const endPosRef = useRef(new THREE.Vector3())
  const endTargetRef = useRef(new THREE.Vector3())
  const lastModuleRef = useRef<typeof activeModule | null>(null)

  // Resolve the target dolly for the current active module + viewport.
  useEffect(() => {
    const isModuleChange = lastModuleRef.current !== activeModule
    lastModuleRef.current = activeModule

    // Hub and modules use the same fit math: a direction vector + a
    // fillRatio of the smaller viewport dimension. On wide desktops
    // Earth is height-bound; on tall phones it's width-bound. Either way
    // the framing reads as "Earth fully visible, centered, with breathing
    // room on the larger axis" instead of overflowing.
    let position: [number, number, number]
    let lookAt: [number, number, number]
    if (activeModule === 'hub') {
      position = positionFromDirection([0, 0, 1], HUB_FILL_RATIO, aspect)
      lookAt = [0, 0, 0]
    } else {
      const dolly = MODULES[activeModule].dolly
      position = positionFromDirection(dolly.direction, dolly.fillRatio, aspect)
      lookAt = dolly.lookAt
      // Mobile portrait: pan the camera DOWN so Earth (which stays at the
      // origin in world space) appears in the upper portion of the
      // viewport above the bottom-anchored card and Timeline. This is a
      // pure translation — camera AND target shift by the same amount, so
      // the camera's forward direction is unchanged and the scene doesn't
      // rotate. Only the framing is offset.
      if (aspect < 0.9) {
        const camDist = Math.hypot(position[0], position[1], position[2])
        const halfFovRad = (CAMERA_FOV_DEG * Math.PI) / 180 / 2
        const viewportHeight = 2 * camDist * Math.tan(halfFovRad)
        const panY = -0.2 * viewportHeight
        position = [position[0], position[1] + panY, position[2]]
        lookAt = [lookAt[0], lookAt[1] + panY, lookAt[2]]
      }
    }

    endPosRef.current.set(...position)
    endTargetRef.current.set(...lookAt)

    if (isModuleChange) {
      // Smooth tween from the camera's current pose to the new dolly.
      startPosRef.current.copy(camera.position)
      if (controls?.target) {
        startTargetRef.current.copy(controls.target)
        controls.enabled = false
      } else {
        startTargetRef.current.set(0, 0, 0)
      }
      startTimeRef.current = performance.now()
    } else if (startTimeRef.current === null) {
      // Aspect-only change with no tween in flight — snap.
      camera.position.set(position[0], position[1], position[2])
      camera.lookAt(lookAt[0], lookAt[1], lookAt[2])
      if (controls?.target) {
        controls.target.set(lookAt[0], lookAt[1], lookAt[2])
        controls.update()
      }
    }
    // Else (aspect change mid-tween): just leave endPosRef updated; the
    // running lerp picks up the new target on its next frame.
  }, [activeModule, aspect, camera, controls])

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
