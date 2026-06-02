import * as THREE from 'three'
import { latLngToVec3 } from '@/src/tectonics/sphericalGeometry'

export type LatLng = readonly [number, number]

/**
 * Subsolar point — where the sun is directly overhead at a given UTC hour.
 *
 * v1 locks Earth to equinox (no axial tilt) so lat is always 0. Longitude
 * sweeps full -180..180 as the day advances: noon (h=12) → lng=0, midnight
 * (h=0/24) → lng=±180, sunrise (h=6) → lng=-90, sunset (h=18) → lng=+90.
 */
export function subsolarPoint(hour: number): LatLng {
  const lng = (hour - 12) * 15 // 360°/24h = 15°/h
  // Wrap to (-180, 180]
  const wrapped = lng > 180 ? lng - 360 : lng <= -180 ? lng + 360 : lng
  return [0, wrapped]
}

/**
 * Unit vector pointing FROM Earth's center TOWARD the sun at hour h.
 * Composed from subsolarPoint so it shares the Z-negated lat/lng convention
 * of latLngToVec3, which downstream R3F components rely on for occlusion
 * and lighting alignment.
 */
export function sunDirection(hour: number): THREE.Vector3 {
  const [lat, lng] = subsolarPoint(hour)
  return latLngToVec3(lat, lng, 1)
}

/**
 * Global brightness of the ITCZ cloud band, in [0, 1].
 *
 * Models the qualitative observation that the ITCZ glows brightest when
 * the sun is directly over its meridian (noon, h=12) and is invisible to
 * the front-facing camera when the sun is on the back of the globe
 * (midnight, h=0). We use a smooth cosine ramp on the sun's longitudinal
 * angle relative to the prime meridian — the cosine peaks at noon, hits 0
 * at sunrise/sunset, and goes slightly negative through the night, which
 * we clamp to 0.
 */
export function itczBrightness(hour: number): number {
  const angleRad = ((hour - 12) / 24) * 2 * Math.PI
  return Math.max(0, Math.cos(angleRad))
}
