import * as THREE from 'three'

/**
 * Converts a (lat, lng) degree pair to a 3D Cartesian point on a sphere of
 * given radius. Uses the convention:
 *   (lat=0, lng=0)   -> (radius, 0, 0)
 *   (lat=90, *)      -> (0, radius, 0)   (north pole, +Y axis)
 *   (lat=0, lng=90)  -> (0, 0, radius)   (+Z axis)
 *
 * This matches three.js's default Y-up orientation; the Earth mesh in the
 * scene uses the same convention.
 */
export function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (lat * Math.PI) / 180
  const theta = (lng * Math.PI) / 180
  const cosPhi = Math.cos(phi)
  return new THREE.Vector3(
    radius * cosPhi * Math.cos(theta),
    radius * Math.sin(phi),
    radius * cosPhi * Math.sin(theta),
  )
}

/**
 * Spherical linear interpolation between two points on the unit sphere.
 * The output lies on the great-circle arc from `a` to `b`. Inputs are
 * expected to lie on the unit sphere; the output will too.
 *
 * t in [0, 1]; t=0 returns a (clone), t=1 returns b (clone).
 *
 * Handles the antipodal and near-zero-angle degenerate cases by falling
 * back to lerp + renormalize.
 */
export function slerpOnSphere(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  if (t <= 0) return a.clone()
  if (t >= 1) return b.clone()

  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1)
  const angle = Math.acos(dot)

  // If the angle is tiny, slerp reduces to lerp. If it's near π (antipodal),
  // the great-circle path is undefined - fall back to lerp + renormalize.
  if (angle < 1e-6 || Math.PI - angle < 1e-6) {
    return new THREE.Vector3().copy(a).lerp(b, t).normalize()
  }

  const sinAngle = Math.sin(angle)
  const wa = Math.sin((1 - t) * angle) / sinAngle
  const wb = Math.sin(t * angle) / sinAngle

  return new THREE.Vector3().copy(a).multiplyScalar(wa).addScaledVector(b, wb)
}

/**
 * Triangulates a convex (or near-convex) polygon as a triangle fan from the
 * polygon's centroid.
 *
 * Returns:
 *   positions: Float32Array of (centroid, v0, v1, ..., vN) as flat [x,y,z,...]
 *   indices:   Uint32Array of triangle indices forming N triangles
 *              (centroid, vI, v[I+1]) for I = 0..N-1 (wrapping)
 *
 * Limitations: only correct for convex polygons. Our hand-authored plate
 * polygons are simplified to be near-convex; if a polygon is wildly concave
 * the rendered shape may include overlapping triangles.
 */
export function triangulatePolygonFan(verticesVec3: ReadonlyArray<THREE.Vector3>): {
  positions: Float32Array
  indices: Uint32Array
} {
  const n = verticesVec3.length

  // Centroid: arithmetic mean projected back to the sphere surface.
  // Plain (A+B+C)/3 on a sphere lies INSIDE the sphere; for large polygons
  // this places the centroid near the sphere center, and the fan
  // triangulation cuts through the sphere's interior. Normalizing back to
  // the vertex radius keeps every triangle vertex on the same surface.
  const centroid = new THREE.Vector3()
  for (const v of verticesVec3) centroid.add(v)
  centroid.divideScalar(n)
  const targetRadius = (verticesVec3[0] ?? new THREE.Vector3(1, 0, 0)).length()
  if (centroid.lengthSq() > 1e-12) {
    centroid.normalize().multiplyScalar(targetRadius)
  }

  // Positions: centroid first, then all n vertices. Total = n + 1 positions.
  const positions = new Float32Array((n + 1) * 3)
  positions[0] = centroid.x
  positions[1] = centroid.y
  positions[2] = centroid.z
  for (let i = 0; i < n; i++) {
    const v = verticesVec3[i] as THREE.Vector3
    positions[(i + 1) * 3 + 0] = v.x
    positions[(i + 1) * 3 + 1] = v.y
    positions[(i + 1) * 3 + 2] = v.z
  }

  // Indices: n triangles, each (centroid=0, vI=1+i, v[I+1]=1+((i+1) % n)).
  const indices = new Uint32Array(n * 3)
  for (let i = 0; i < n; i++) {
    indices[i * 3 + 0] = 0
    indices[i * 3 + 1] = 1 + i
    indices[i * 3 + 2] = 1 + ((i + 1) % n)
  }

  return { positions, indices }
}
