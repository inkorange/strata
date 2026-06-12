'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import { Atmosphere } from '@/src/atmos/scene/Atmosphere'
import { CloudBand } from '@/src/atmos/scene/CloudBand'
import { Sun } from '@/src/atmos/scene/Sun'
import { EARTH_TILT_RAD } from '@/src/atmos/solar'
import { usePrefersReducedMotion } from '@/src/lib/accessibility'
import { useStore } from '@/src/store'
import { Reservoirs } from '@/src/systems/scene/Reservoirs'
import { Plates } from '@/src/tectonics/scene/Plates'
import { TectonicsOcean } from '@/src/tectonics/scene/TectonicsOcean'
import { CameraDolly } from './CameraDolly'
import { Earth } from './Earth'
import { PostProcessing } from './PostProcessing'
import { Scene } from './Scene'

/** Radians per second when Earth rotates continuously in non-atmosphere
 *  modes (hub / tectonics / systems). ~60 s per full rotation — slow
 *  enough to read as gentle ambient motion, not jittery. */
const AMBIENT_SPIN_RATE = 0.1

/**
 * Tilted, hour-driven spinning frame for Earth and its surface-anchored
 * layers. The outer group is rotated around world-X by 23.44° so the
 * geographic axis points off-vertical in the canonical Earth-from-space
 * pose. The inner spin group's rotation.y is derived directly from
 * `hour`: at h=12 the spin angle is 0 so lng=0 faces world +X (where the
 * sun lives in the heliocentric model); at h=18 the spin is -π/2 so
 * lng=90 faces +X; etc. This couples Earth's orientation to the scrubber
 * so the day/night terminator on Earth comes from Earth's rotation, not
 * the sun moving.
 *
 * When `spinning` is false (e.g. tectonics, hub) the spin angle stays at
 * 0 — the tilt is still applied for visual consistency, but the rotation
 * doesn't track hour.
 */
function EarthFrame({ spinning, children }: { spinning: boolean; children: React.ReactNode }) {
  const season = useStore((s) => s.season)
  const prefersReducedMotion = usePrefersReducedMotion()
  const spinRef = useRef<THREE.Group>(null)

  // Axial tilt direction depends on season — which way Earth's N pole
  // points in space relative to the (world +X) sun. Tilt magnitude is the
  // same (23.44°); only the rotation axis changes:
  //   - equinox:            rotate around world X. N pole ends at
  //                          (0, cos, -sin), perpendicular to the sun.
  //   - june solstice:      rotate around world -Z. N pole ends at
  //                          (sin, cos, 0), tilting toward the sun.
  //   - december solstice:  rotate around world +Z. N pole ends at
  //                          (-sin, cos, 0), tilting away from the sun.
  let tilt: [number, number, number]
  if (spinning && season === 'june-solstice') {
    tilt = [0, 0, -EARTH_TILT_RAD]
  } else if (spinning && season === 'december-solstice') {
    tilt = [0, 0, EARTH_TILT_RAD]
  } else {
    tilt = [EARTH_TILT_RAD, 0, 0]
  }

  // Spin per frame:
  //   - Atmosphere mode: spin angle is set from the current `hour` each
  //     frame, so manual scrub and play loop both drive Earth's rotation
  //     under the fixed sun.
  //   - Other modes: continuous slow rotation around the tilted local Y
  //     axis, ~60s per turn — keeps the hub/tectonics/systems Earth
  //     visibly alive instead of frozen on its tilted pose.
  useFrame((_, dt) => {
    const g = spinRef.current
    if (!g) return
    if (prefersReducedMotion) return
    if (spinning) {
      const hour = useStore.getState().hour
      g.rotation.y = -((hour - 12) * Math.PI) / 12
    } else {
      g.rotation.y += dt * AMBIENT_SPIN_RATE
    }
  })

  return (
    <group rotation={tilt}>
      <group ref={spinRef}>{children}</group>
    </group>
  )
}

/**
 * One scene mount that lives in the root layout. Stays mounted across
 * route changes - navigation only toggles which UI overlays render on
 * top. CameraDolly reads activeModule from the store and tweens between
 * positions on its own; no Canvas remount, no WebGL context teardown.
 *
 * Heliocentric layering for atmosphere:
 *   - <CameraDolly />, <PostProcessing /> at scene root (world-space).
 *   - <Sun /> at scene root, fixed at world +X · SUN_DISTANCE.
 *   - <EarthFrame> tilts and spins everything Earth-anchored: Earth mesh,
 *     plates, surface atmosphere overlays AND the ITCZ cloud band. Earth
 *     spinning under a fixed sun is what creates day and night — the
 *     bright sun-facing cloud arc stays in world +X while puffs at
 *     different geographic longitudes rotate through it.
 *   - Slow camera autoRotate (configured in Scene.tsx) revolves the whole
 *     view, so the user sees the sun-Earth system from changing angles
 *     without the sun appearing to revolve around Earth.
 */
export function PersistentScene() {
  const activeModule = useStore((s) => s.activeModule)
  const spinning = activeModule === 'atmosphere'

  return (
    <div className="fixed inset-0">
      <Scene controls={true}>
        <CameraDolly />
        <PostProcessing />
        <Sun />
        <EarthFrame spinning={spinning}>
          <Earth />
          <TectonicsOcean />
          <Plates />
          <Atmosphere />
          <CloudBand />
          <Reservoirs />
        </EarthFrame>
      </Scene>
    </div>
  )
}
