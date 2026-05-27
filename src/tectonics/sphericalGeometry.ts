import * as THREE from 'three'

/**
 * Converts a (lat, lng) degree pair to a 3D Cartesian point on a sphere of
 * given radius, matching three.js's default SphereGeometry UV mapping for
 * an equirectangular Earth texture (lng=-180 at u=0, lng=0 at u=0.5).
 *
 * three.js SphereGeometry generates vertices with x = -r·cos(u·2π)·sin(v·π)
 * and z = r·sin(u·2π)·sin(v·π), which after the texture's lng→u mapping
 * works out to:
 *   x =  r · cos(lat) · cos(lng)
 *   y =  r · sin(lat)
 *   z = -r · cos(lat) · sin(lng)
 *
 * The Z is negated relative to the naïve spherical formula because longitude
 * increases CLOCKWISE when viewed from the north pole (standard cartographic
 * convention), while a +sin(theta) Z would put it counter-clockwise.
 *
 *   (lat=0,  lng=0)   -> ( radius, 0, 0)       (prime meridian, +X)
 *   (lat=90, *)       -> (0, radius, 0)        (north pole, +Y)
 *   (lat=0,  lng=90)  -> (0, 0, -radius)       (90°E, -Z)
 *   (lat=0,  lng=-90) -> (0, 0,  radius)       (90°W, +Z)
 */
export function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (lat * Math.PI) / 180
  const theta = (lng * Math.PI) / 180
  const cosPhi = Math.cos(phi)
  return new THREE.Vector3(
    radius * cosPhi * Math.cos(theta),
    radius * Math.sin(phi),
    -radius * cosPhi * Math.sin(theta),
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
 * polygon's centroid, then optionally subdivides each triangle recursively
 * to reduce chord-plane sag on a sphere.
 *
 * On a sphere, a flat triangle with vertices on the surface bows INWARD —
 * the triangle interior sits on the chord plane, which dips inside the
 * sphere by R(1 - cos(angle/2)) where angle is the angular span between
 * vertices at the sphere center. For large polygons (Pacific spans 150°+)
 * the sag dominates the radial buffer between the plate and the Earth
 * surface and the plate interior gets occluded.
 *
 * Each subdivision level splits every triangle into 4 by inserting
 * midpoints (projected back to the sphere) on each edge, reducing the
 * remaining angular span (and thus chord-plane sag) by ~4x per level.
 *
 * Returns:
 *   positions: Float32Array of [x,y,z,...] for all unique vertices
 *   indices:   Uint32Array of triangle indices into positions
 *
 * Limitations: only correct for convex polygons (fan triangulation
 * assumption). Subdivision preserves the polygon's outer boundary; only
 * interior triangles get denser.
 */
export function triangulatePolygonFan(
  verticesVec3: ReadonlyArray<THREE.Vector3>,
  subdivisions = 0,
): { positions: Float32Array; indices: Uint32Array } {
  const n = verticesVec3.length

  // Centroid: arithmetic mean projected back to the sphere surface so all
  // initial triangle vertices lie at the same radius.
  const centroid = new THREE.Vector3()
  for (const v of verticesVec3) centroid.add(v)
  centroid.divideScalar(n)
  const targetRadius = (verticesVec3[0] ?? new THREE.Vector3(1, 0, 0)).length()
  if (centroid.lengthSq() > 1e-12) {
    centroid.normalize().multiplyScalar(targetRadius)
  }

  // Initial fan: [centroid, v0, v1, ..., vN-1] positions; one triangle per
  // perimeter edge (centroid, vI, v[I+1 mod N]).
  let positions: THREE.Vector3[] = [centroid, ...verticesVec3.map((v) => v.clone())]
  let indices: number[] = []
  for (let i = 0; i < n; i++) {
    indices.push(0, 1 + i, 1 + ((i + 1) % n))
  }

  for (let level = 0; level < subdivisions; level++) {
    const next = subdivideTriangles(positions, indices, targetRadius)
    positions = next.positions
    indices = next.indices
  }

  // Flatten to typed arrays.
  const flatPositions = new Float32Array(positions.length * 3)
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i] as THREE.Vector3
    flatPositions[i * 3 + 0] = p.x
    flatPositions[i * 3 + 1] = p.y
    flatPositions[i * 3 + 2] = p.z
  }
  return {
    positions: flatPositions,
    indices: new Uint32Array(indices),
  }
}

/**
 * Concave-safe triangulation of a polygon defined by (lat, lng) vertices,
 * projected onto a sphere of given radius. Uses three.js's ShapeUtils
 * (earcut under the hood) on a 2D projection so concavities — peninsulas,
 * fjords, the indented coastlines of real countries — don't produce the
 * star/spike artifacts a centroid fan generates for non-star-shaped
 * polygons.
 *
 * Projection: vertices are mapped to 2D by treating (lng, lat) as planar
 * coordinates. Earcut only needs topological correctness, so metric
 * distortion is fine for polygons that don't straddle the poles or wrap
 * the date line (which Natural Earth country polygons don't — antimeridian-
 * crossing landmasses are split into separate pieces in the source data).
 *
 * After earcut yields triangles in vertex-index space, every vertex is
 * promoted to its 3D position on the sphere and the triangles are
 * subdivided to reduce chord-plane sag the same way triangulatePolygonFan
 * does — splitting each triangle into 4 per level and projecting new
 * midpoints back to the sphere.
 *
 * Returns:
 *   positions: Float32Array of [x,y,z,...] vertex positions on the sphere
 *   indices:   Uint32Array of triangle indices
 *
 * If earcut fails to produce any triangles (degenerate input, self-
 * intersecting ring) the function returns empty arrays so the caller can
 * skip rendering that piece without crashing.
 */
export function triangulatePolygonOnSphere(
  latLngVertices: ReadonlyArray<readonly [number, number]>,
  radius: number,
  subdivisions = 0,
): { positions: Float32Array; indices: Uint32Array } {
  const n = latLngVertices.length
  if (n < 3) return { positions: new Float32Array(0), indices: new Uint32Array(0) }

  // 2D projection for earcut: just use (lng, lat). Earcut works on planar
  // topology; the actual 3D positions go on the sphere below.
  const contour2D: THREE.Vector2[] = []
  for (let i = 0; i < n; i++) {
    const v = latLngVertices[i]
    if (!v) continue
    const [lat, lng] = v
    contour2D.push(new THREE.Vector2(lng, lat))
  }

  const faces = THREE.ShapeUtils.triangulateShape(contour2D, [])
  if (faces.length === 0) {
    return { positions: new Float32Array(0), indices: new Uint32Array(0) }
  }

  let positions: THREE.Vector3[] = latLngVertices.map(([lat, lng]) =>
    latLngToVec3(lat, lng, radius),
  )
  let indices: number[] = []
  for (const tri of faces) {
    const [a, b, c] = tri as [number, number, number]
    indices.push(a, b, c)
  }

  for (let level = 0; level < subdivisions; level++) {
    const next = subdivideTriangles(positions, indices, radius)
    positions = next.positions
    indices = next.indices
  }

  const flatPositions = new Float32Array(positions.length * 3)
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i] as THREE.Vector3
    flatPositions[i * 3 + 0] = p.x
    flatPositions[i * 3 + 1] = p.y
    flatPositions[i * 3 + 2] = p.z
  }
  return {
    positions: flatPositions,
    indices: new Uint32Array(indices),
  }
}

/**
 * One pass of triangle subdivision. Each triangle [a, b, c] becomes 4:
 *   [a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]
 * where ab/bc/ca are the edge midpoints, projected to the sphere at the
 * given radius. A shared edge-midpoint cache prevents duplicate vertices
 * between adjacent triangles.
 */
function subdivideTriangles(
  positions: ReadonlyArray<THREE.Vector3>,
  indices: ReadonlyArray<number>,
  radius: number,
): { positions: THREE.Vector3[]; indices: number[] } {
  const newPositions: THREE.Vector3[] = positions.map((p) => p.clone())
  const newIndices: number[] = []
  const edgeCache = new Map<string, number>()

  function midpointIndex(ia: number, ib: number): number {
    const key = ia < ib ? `${ia}_${ib}` : `${ib}_${ia}`
    const cached = edgeCache.get(key)
    if (cached !== undefined) return cached

    const a = positions[ia] as THREE.Vector3
    const b = positions[ib] as THREE.Vector3
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
    if (mid.lengthSq() > 1e-12) {
      mid.normalize().multiplyScalar(radius)
    } else {
      // Antipodal midpoint: pick an arbitrary perpendicular direction.
      const perp = new THREE.Vector3(1, 0, 0)
      if (Math.abs(a.x / radius) > 0.9) perp.set(0, 1, 0)
      mid.copy(perp).normalize().multiplyScalar(radius)
    }
    const idx = newPositions.length
    newPositions.push(mid)
    edgeCache.set(key, idx)
    return idx
  }

  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] as number
    const b = indices[t + 1] as number
    const c = indices[t + 2] as number
    const ab = midpointIndex(a, b)
    const bc = midpointIndex(b, c)
    const ca = midpointIndex(c, a)
    // 4 sub-triangles
    newIndices.push(a, ab, ca)
    newIndices.push(b, bc, ab)
    newIndices.push(c, ca, bc)
    newIndices.push(ab, bc, ca)
  }

  return { positions: newPositions, indices: newIndices }
}
