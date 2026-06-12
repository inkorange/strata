import * as THREE from 'three'
import { latLngToVec3 } from '@/src/tectonics/sphericalGeometry'

export type LatLng = readonly [number, number]

/**
 * Where Earth is in its orbit around the sun — only the three positions
 * with distinct atmospheric consequences are exposed in v1.
 *   - 'equinox':            subsolar point on the geographic equator (both
 *                            equinoxes look the same from a single-day view).
 *   - 'june-solstice':      subsolar at the Tropic of Cancer (+23.44° N);
 *                            N pole tilts TOWARD the sun.
 *   - 'december-solstice':  subsolar at the Tropic of Capricorn (-23.44° S);
 *                            N pole tilts AWAY from the sun.
 */
export type Season = 'equinox' | 'june-solstice' | 'december-solstice'

/**
 * Earth's real-world axial tilt, in radians. Shared between solar.ts (so the
 * sun's world-space direction matches Earth's tilted geographic equator)
 * and the PersistentScene EarthFrame (so the Earth mesh itself is tilted
 * to the same angle). Single source of truth — changing this constant
 * keeps the sun's path aligned with Earth's equator automatically.
 */
export const EARTH_TILT_RAD = (23.44 * Math.PI) / 180

/** Earth's axial tilt expressed in degrees. */
export const EARTH_TILT_DEG = 23.44

/**
 * Subsolar latitude (degrees) for each season. At equinox the sun crosses
 * the equator; at solstices it crosses one of the tropics.
 */
export function subsolarLatForSeason(season: Season): number {
  if (season === 'june-solstice') return EARTH_TILT_DEG
  if (season === 'december-solstice') return -EARTH_TILT_DEG
  return 0
}

/**
 * Subsolar point — where the sun is directly overhead at a given UTC hour
 * and orbital season.
 *
 * Latitude depends on `season`:
 *   - 'equinox':            lat = 0      (sun crosses the geographic equator)
 *   - 'june-solstice':      lat = +23.44 (Tropic of Cancer)
 *   - 'december-solstice':  lat = -23.44 (Tropic of Capricorn)
 *
 * Longitude sweeps full -180..180 as the day advances: noon (h=12) → lng=0,
 * midnight (h=0/24) → lng=±180, sunrise (h=6) → lng=-90, sunset (h=18) →
 * lng=+90. Canonicalized to the half-open range (-180, 180].
 */
export function subsolarPoint(hour: number, season: Season = 'equinox'): LatLng {
  const lat = subsolarLatForSeason(season)
  const lng = (hour - 12) * 15 // 360°/24h = 15°/h
  // Wrap to (-180, 180]
  const wrapped = lng > 180 ? lng - 360 : lng <= -180 ? lng + 360 : lng
  return [lat, wrapped]
}

/**
 * Unit vector pointing FROM Earth's center TOWARD the subsolar point,
 * expressed in Earth's LOCAL frame.
 *
 * In the heliocentric scene model the sun is fixed at world +X * distance;
 * the visual <Sun /> hard-codes that position. What this function returns
 * is the Earth-local direction the subsolar point lies in at hour h —
 * which is how downstream pure-TS code (sample.ts) compares a point's
 * Earth-local position against "which way is the sun" to decide day/night
 * illumination. Dotting an Earth-local point with this vector gives the
 * same answer as dotting the rotated world point against the world sun,
 * by rotation invariance.
 */
export function sunDirection(hour: number, season: Season = 'equinox'): THREE.Vector3 {
  const [lat, lng] = subsolarPoint(hour, season)
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
