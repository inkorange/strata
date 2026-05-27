import * as THREE from 'three'
import type { ContinentId, Era, PlateId } from './eras'
import { latLngToVec3, slerpOnSphere } from './sphericalGeometry'

export interface TweenedPlate {
  id: PlateId
  vertices: ReadonlyArray<readonly [number, number]>
}

/**
 * Interpolates plate positions between two eras at progress t in [0, 1].
 *
 * For each plate present in both eras, each vertex pair (source, target) is
 * SLERP'd along the great-circle arc on the unit sphere, then projected back
 * to (lat, lng) degrees. Vertex counts must match between source and target
 * (enforced at data-integrity test time in eras.spec.ts).
 *
 * At t=0 returns source plates verbatim; at t=1 returns target verbatim.
 */
export function tweenPlates(source: Era, target: Era, t: number): ReadonlyArray<TweenedPlate> {
  const result: TweenedPlate[] = []

  for (const sourcePlate of source.plates) {
    const targetPlate = target.plates.find((p) => p.id === sourcePlate.id)
    if (!targetPlate) continue

    if (t <= 0) {
      result.push({ id: sourcePlate.id, vertices: sourcePlate.vertices })
      continue
    }
    if (t >= 1) {
      result.push({ id: sourcePlate.id, vertices: targetPlate.vertices })
      continue
    }

    const interpolated: Array<readonly [number, number]> = []
    for (let i = 0; i < sourcePlate.vertices.length; i++) {
      const [slat, slng] = sourcePlate.vertices[i] as [number, number]
      const [tlat, tlng] = targetPlate.vertices[i] as [number, number]

      const va = latLngToVec3(slat, slng, 1)
      const vb = latLngToVec3(tlat, tlng, 1)
      const vi = slerpOnSphere(va, vb, t)

      // Convert interpolated vec3 back to (lat, lng) degrees. Must be the
      // exact inverse of latLngToVec3, which negates z, so the lng inverse
      // is atan2(-z, x) — not atan2(z, x). Using the wrong sign here makes
      // tweens snap to a longitude-mirrored pose on the first frame of
      // animation because the SLERP→lat/lng→vec3 roundtrip in the renderer
      // produces a position far from the source.
      const lat = (Math.asin(THREE.MathUtils.clamp(vi.y, -1, 1)) * 180) / Math.PI
      const lng = (Math.atan2(-vi.z, vi.x) * 180) / Math.PI
      interpolated.push([lat, lng] as const)
    }

    result.push({ id: sourcePlate.id, vertices: interpolated })
  }

  return result
}

export interface TweenedContinent {
  id: ContinentId
  polygons: ReadonlyArray<ReadonlyArray<readonly [number, number]>>
}

/**
 * Interpolates continent positions between two eras at progress t in [0, 1].
 *
 * Each continent carries multiple polygon pieces (mainland + islands). Each
 * piece is SLERP'd vertex-by-vertex. Piece count and per-piece vertex counts
 * must match between source and target (enforced at data level since all eras
 * share the same Present-derived multipolygon shape).
 *
 * At t=0 returns source continents verbatim; at t=1 returns target verbatim.
 */
export function tweenContinents(
  source: Era,
  target: Era,
  t: number,
): ReadonlyArray<TweenedContinent> {
  const result: TweenedContinent[] = []

  for (const sourceContinent of source.continents) {
    const targetContinent = target.continents.find((c) => c.id === sourceContinent.id)
    if (!targetContinent) continue

    if (t <= 0) {
      result.push({ id: sourceContinent.id, polygons: sourceContinent.polygons })
      continue
    }
    if (t >= 1) {
      result.push({ id: sourceContinent.id, polygons: targetContinent.polygons })
      continue
    }

    const interpolatedPolys: Array<ReadonlyArray<readonly [number, number]>> = []
    for (let p = 0; p < sourceContinent.polygons.length; p++) {
      const sourcePiece = sourceContinent.polygons[p] as ReadonlyArray<readonly [number, number]>
      const targetPiece = targetContinent.polygons[p] as
        | ReadonlyArray<readonly [number, number]>
        | undefined
      if (!targetPiece) continue

      const piece: Array<readonly [number, number]> = []
      for (let i = 0; i < sourcePiece.length; i++) {
        const [slat, slng] = sourcePiece[i] as [number, number]
        const [tlat, tlng] = targetPiece[i] as [number, number]

        const va = latLngToVec3(slat, slng, 1)
        const vb = latLngToVec3(tlat, tlng, 1)
        const vi = slerpOnSphere(va, vb, t)

        const lat = (Math.asin(THREE.MathUtils.clamp(vi.y, -1, 1)) * 180) / Math.PI
        const lng = (Math.atan2(-vi.z, vi.x) * 180) / Math.PI
        piece.push([lat, lng] as const)
      }
      interpolatedPolys.push(piece)
    }

    result.push({ id: sourceContinent.id, polygons: interpolatedPolys })
  }

  return result
}
