import * as THREE from 'three'
import { latLngToVec3 } from '@/src/tectonics/sphericalGeometry'

export interface CellBand {
  id: 'polar-n' | 'westerly-n' | 'trade-n' | 'trade-s' | 'westerly-s' | 'polar-s'
  latDeg: number
  belt: 'trade' | 'westerly' | 'polar'
  /** Total arrows around the full latitude ring. ~half are on the visible
   *  front of the globe from any single camera angle. */
  arrowsAroundRing: 4 | 6 | 8
  /** Per-arrow canonical shape in surface-tangent local coords (degrees
   *  along-band and perp-to-band). Curves at trade latitudes pull the
   *  perimeter end toward the equator; westerly + polar shapes are
   *  effectively straight along the band. */
  shape: {
    /** Longitudinal span of the arrow along the band, in degrees. */
    arcDeg: number
    /** Latitudinal pull at the arrow's end, in degrees toward the equator
     *  (positive value bends the arrow's terminus equatorward). */
    equatorPullDeg: number
  }
}

export const CELL_BANDS: ReadonlyArray<CellBand> = Object.freeze([
  // North hemisphere
  {
    id: 'polar-n',
    latDeg: 75,
    belt: 'polar',
    arrowsAroundRing: 4,
    shape: { arcDeg: 24, equatorPullDeg: 0 },
  },
  {
    id: 'westerly-n',
    latDeg: 45,
    belt: 'westerly',
    arrowsAroundRing: 6,
    shape: { arcDeg: 28, equatorPullDeg: 0 },
  },
  {
    id: 'trade-n',
    latDeg: 15,
    belt: 'trade',
    arrowsAroundRing: 8,
    shape: { arcDeg: 22, equatorPullDeg: 6 },
  },
  // South hemisphere (mirror)
  {
    id: 'trade-s',
    latDeg: -15,
    belt: 'trade',
    arrowsAroundRing: 8,
    shape: { arcDeg: 22, equatorPullDeg: 6 },
  },
  {
    id: 'westerly-s',
    latDeg: -45,
    belt: 'westerly',
    arrowsAroundRing: 6,
    shape: { arcDeg: 28, equatorPullDeg: 0 },
  },
  {
    id: 'polar-s',
    latDeg: -75,
    belt: 'polar',
    arrowsAroundRing: 4,
    shape: { arcDeg: 24, equatorPullDeg: 0 },
  },
])

/**
 * Sample N evenly-spaced 3D points along one arrow's arc on the unit sphere.
 *
 * The arc is laid out in (lng, lat) using the band's `shape` definition, then
 * each (lat, lng) is projected to vec3 via latLngToVec3. Longitudinal flow
 * direction depends on the belt: trade and polar belts blow east→west
 * (arrowhead at the western end), westerlies blow west→east.
 * The interpolation is linear in longitude with smoothstep easing on latitude, then projected to the sphere — this is not a strict SLERP/great-circle path, but the visual difference is negligible for the small arc spans (22–28°) used here.
 *
 * `arrowsAroundRing` is the parameter the caller passes (typically just
 * `band.arrowsAroundRing`) and controls the per-arrow longitude offset:
 * arrow `longitudeIndex` is centered at lng = (360/arrowsAroundRing) * idx.
 *
 * `segments` is the resolution along the arc (number of points returned
 * is segments + 1).
 */
export function arrowArcPoints(
  band: CellBand,
  longitudeIndex: number,
  arrowsAroundRing: number,
  segments: number,
  latOffsetDeg = 0,
): THREE.Vector3[] {
  const startLng = (360 / arrowsAroundRing) * longitudeIndex - 180
  // Westerlies flow west→east (flowSign = +1); trade winds and polar
  // easterlies flow east→west (flowSign = -1).
  const flowSign = band.belt === 'westerly' ? +1 : -1
  const endLng = startLng + flowSign * band.shape.arcDeg
  // Equator pull: trade arrows bend toward the equator at their terminus.
  // We compute the "equator" relative to the offset center latitude so
  // the seasonal shift carries the arrow shape with it (a band shifted
  // 12° north still bends its terminus toward the shifted equator).
  const baseLat = band.latDeg + latOffsetDeg
  const equatorSign = band.latDeg >= 0 ? -1 : +1
  const endLat = baseLat + equatorSign * band.shape.equatorPullDeg

  const out: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const eased = t * t * (3 - 2 * t) // smoothstep so the curve eases
    const lng = startLng + (endLng - startLng) * t
    const lat = baseLat + (endLat - baseLat) * eased
    out.push(latLngToVec3(lat, lng, 1))
  }
  return out
}

/** Every arrow in every band, ready for mesh construction. `latOffsetDeg`
 *  shifts the whole assembly toward the summer hemisphere — see Cells.tsx,
 *  which scales this from the current season's subsolar latitude. */
export function allArrowArcs(
  latOffsetDeg = 0,
): { band: CellBand; longitudeIndex: number; points: THREE.Vector3[] }[] {
  const out: { band: CellBand; longitudeIndex: number; points: THREE.Vector3[] }[] = []
  for (const band of CELL_BANDS) {
    for (let i = 0; i < band.arrowsAroundRing; i++) {
      out.push({
        band,
        longitudeIndex: i,
        points: arrowArcPoints(band, i, band.arrowsAroundRing, 16, latOffsetDeg),
      })
    }
  }
  return out
}
