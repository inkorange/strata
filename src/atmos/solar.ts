import * as THREE from 'three'
import { latLngToVec3 } from '@/src/tectonics/sphericalGeometry'

export type LatLng = readonly [number, number]

/**
 * Subsolar point — where the sun is directly overhead at a given UTC hour.
 *
 * v1 locks Earth to equinox (no axial tilt) so lat is always 0. Longitude
 * sweeps full -180..180 as the day advances: noon (h=12) → lng=0, midnight
 * (h=0/24) → lng=±180, sunrise (h=6) → lng=-90, sunset (h=18) → lng=+90.
 *
 * Longitude is canonicalized to the half-open range (-180, 180]: the boundary at midnight maps to +180 (not -180), so consumers see the same sign whether they reached midnight from above (h→0) or below (h→24).
 */
export function subsolarPoint(hour: number): LatLng {
  const lng = (hour - 12) * 15 // 360°/24h = 15°/h
  // Wrap to (-180, 180]
  const wrapped = lng > 180 ? lng - 360 : lng <= -180 ? lng + 360 : lng
  return [0, wrapped]
}

/**
 * Unit vector pointing FROM Earth's center TOWARD the sun at hour h.
 * Composed via latLngToVec3 so it inherits the same coordinate convention — downstream R3F components and shaders can use it interchangeably with latLngToVec3 outputs.
 */
export function sunDirection(hour: number): THREE.Vector3 {
  const [lat, lng] = subsolarPoint(hour)
  return latLngToVec3(lat, lng, 1)
}

/**
 * View-angle illumination of the equatorial ITCZ cloud band, in [0, 1].
 *
 * This is a camera-facing brightness model — NOT a meteorological measure
 * of ITCZ intensity. The actual ITCZ exists year-round; this function
 * answers "how brightly is the visible front of the equator lit by the
 * sun right now?" It peaks at noon (sun over the prime meridian, fully
 * facing the +Z camera) and falls to 0 on the night side.
 *
 * Implementation: cos of the sun's angular displacement from the prime
 * meridian, clamped to [0, 1].
 */
export function itczBrightness(hour: number): number {
  const angleRad = ((hour - 12) / 24) * 2 * Math.PI
  return Math.max(0, Math.cos(angleRad))
}
