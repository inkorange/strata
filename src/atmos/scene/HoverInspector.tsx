'use client'

import { type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import { useStore } from '@/src/store'
import { vec3ToLatLng } from '@/src/tectonics/sphericalGeometry'

const INSPECT_RADIUS = 1.01 // slightly above the Earth surface

/**
 * Invisible sphere that intercepts pointer events on the Earth. Each
 * intersection writes two things to the store, debounced to once per
 * ~16ms so we don't flood the reducer on every pointer move:
 *   - inspectAt:     geographic (lat, lng) of the hit, used to sample
 *                    conditions for the readout
 *   - inspectScreen: page-space (x, y) of the cursor, used by
 *                    <InspectReadout> to anchor the panel next to the
 *                    click/hover point so the data isn't disconnected
 *                    from where the user pointed
 *
 * Both pointermove (desktop hover, touch drag) and pointerdown (tap)
 * trigger an update so the readout responds to taps on mobile.
 * pointerout clears both so the readout disappears.
 */
export function HoverInspector() {
  const setInspectAt = useStore((s) => s.setInspectAt)
  const setInspectScreen = useStore((s) => s.setInspectScreen)
  const lastDispatchRef = useRef(0)

  const handlePointer = (e: ThreeEvent<PointerEvent>) => {
    const now = performance.now()
    if (now - lastDispatchRef.current < 16) return
    lastDispatchRef.current = now
    // The Earth (and this raycaster mesh) lives inside a tilted, spinning
    // group. e.point is in world space, but we want the hit's geographic
    // (lat, lng) in Earth's LOCAL frame — i.e. the same point regardless
    // of how Earth is tilted or which way it's currently facing. Inverting
    // through the mesh's parent transform gives us that.
    const local = e.point.clone()
    e.object.worldToLocal(local)
    local.normalize()
    const [lat, lng] = vec3ToLatLng(local)
    setInspectAt([lat, lng])
    setInspectScreen({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
  }

  const handleOut = () => {
    setInspectAt(null)
    setInspectScreen(null)
  }

  return (
    <mesh
      onPointerMove={handlePointer}
      onPointerDown={handlePointer}
      onPointerOut={handleOut}
      visible={false}
    >
      <sphereGeometry args={[INSPECT_RADIUS, 64, 64]} />
      <meshBasicMaterial color="white" transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
