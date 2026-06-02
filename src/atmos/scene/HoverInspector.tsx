'use client'

import { type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import { useStore } from '@/src/store'
import { vec3ToLatLng } from '@/src/tectonics/sphericalGeometry'

const INSPECT_RADIUS = 1.01 // slightly above the Earth surface

/**
 * Invisible sphere that intercepts pointer events on the Earth. Converts
 * each intersection point to (lat, lng) via vec3ToLatLng and writes it to
 * the store as inspectAt, debounced to once per ~16ms so we don't flood
 * the reducer on every pointer move.
 *
 * On pointerOut, clears inspectAt so the readout disappears.
 */
export function HoverInspector() {
  const setInspectAt = useStore((s) => s.setInspectAt)
  const lastDispatchRef = useRef(0)

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    const now = performance.now()
    if (now - lastDispatchRef.current < 16) return
    lastDispatchRef.current = now
    const p = e.point.clone().normalize() // hit may be slightly off-sphere due to float
    const [lat, lng] = vec3ToLatLng(p)
    setInspectAt([lat, lng])
  }

  const handleOut = () => {
    setInspectAt(null)
  }

  return (
    <mesh onPointerMove={handleMove} onPointerOut={handleOut} visible={false}>
      <sphereGeometry args={[INSPECT_RADIUS, 64, 64]} />
      <meshBasicMaterial color="white" transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
