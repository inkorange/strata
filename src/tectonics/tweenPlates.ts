import type { Era, PlateId } from './eras'
import { latLngToVec3, slerpOnSphere, vec3ToLatLng } from './sphericalGeometry'

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

      const [lat, lng] = vec3ToLatLng(vi)
      interpolated.push([lat, lng] as const)
    }

    result.push({ id: sourcePlate.id, vertices: interpolated })
  }

  return result
}
