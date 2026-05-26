import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { latLngToVec3, slerpOnSphere, triangulatePolygonFan } from './sphericalGeometry'

const FLOAT_TOLERANCE = 1e-6

function approxEqualVec(a: THREE.Vector3, b: THREE.Vector3, _tol = FLOAT_TOLERANCE) {
  expect(a.x).toBeCloseTo(b.x, 5)
  expect(a.y).toBeCloseTo(b.y, 5)
  expect(a.z).toBeCloseTo(b.z, 5)
}

describe('latLngToVec3', () => {
  it('maps (0, 0) to (radius, 0, 0)', () => {
    const v = latLngToVec3(0, 0, 1)
    approxEqualVec(v, new THREE.Vector3(1, 0, 0))
  })

  it('maps the north pole (90, anything) to (0, radius, 0)', () => {
    const v = latLngToVec3(90, 42, 1)
    approxEqualVec(v, new THREE.Vector3(0, 1, 0))
  })

  it('maps the south pole (-90, anything) to (0, -radius, 0)', () => {
    const v = latLngToVec3(-90, -17, 1)
    approxEqualVec(v, new THREE.Vector3(0, -1, 0))
  })

  it('maps (0, 90) to (0, 0, radius)', () => {
    const v = latLngToVec3(0, 90, 1)
    approxEqualVec(v, new THREE.Vector3(0, 0, 1))
  })

  it('maps (0, 180) to (-radius, 0, 0)', () => {
    const v = latLngToVec3(0, 180, 1)
    approxEqualVec(v, new THREE.Vector3(-1, 0, 0))
  })

  it('scales by the radius parameter', () => {
    const v = latLngToVec3(0, 0, 5)
    approxEqualVec(v, new THREE.Vector3(5, 0, 0))
  })
})

describe('slerpOnSphere', () => {
  it('returns a verbatim at t=0', () => {
    const a = new THREE.Vector3(1, 0, 0)
    const b = new THREE.Vector3(0, 1, 0)
    approxEqualVec(slerpOnSphere(a, b, 0), a)
  })

  it('returns b verbatim at t=1', () => {
    const a = new THREE.Vector3(1, 0, 0)
    const b = new THREE.Vector3(0, 1, 0)
    approxEqualVec(slerpOnSphere(a, b, 1), b)
  })

  it('returns the midpoint on the great circle at t=0.5', () => {
    // From (1,0,0) to (0,1,0) — midpoint is (cos 45°, sin 45°, 0) on the unit circle.
    const a = new THREE.Vector3(1, 0, 0)
    const b = new THREE.Vector3(0, 1, 0)
    const mid = slerpOnSphere(a, b, 0.5)
    const expected = new THREE.Vector3(Math.SQRT1_2, Math.SQRT1_2, 0)
    approxEqualVec(mid, expected)
  })

  it('output lies on the unit sphere for inputs on the unit sphere', () => {
    const a = new THREE.Vector3(1, 0, 0)
    const b = new THREE.Vector3(0, 0, 1)
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const out = slerpOnSphere(a, b, t)
      expect(out.length()).toBeCloseTo(1, 5)
    }
  })
})

describe('triangulatePolygonFan', () => {
  it('triangulates a 4-vertex polygon into n-2 = 2 triangles via fan from centroid', () => {
    // Square in the xz-plane.
    const vertices = [
      new THREE.Vector3(1, 0, 1),
      new THREE.Vector3(-1, 0, 1),
      new THREE.Vector3(-1, 0, -1),
      new THREE.Vector3(1, 0, -1),
    ]
    const { positions, indices } = triangulatePolygonFan(vertices)
    // 4 vertices + 1 centroid = 5 positions; positions is flat [x,y,z,...] = 15 floats.
    expect(positions.length).toBe(15)
    // 4 fan triangles around the centroid.
    expect(indices.length).toBe(12)
  })

  it('projects the centroid back to the sphere surface (same radius as vertices)', () => {
    // Three unit-sphere points; mean is (0, 1/3, 0), which normalized gives
    // (0, 1, 0) at radius 1.
    const vertices = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(-1, 0, 0),
    ]
    const { positions } = triangulatePolygonFan(vertices)
    expect(positions[0]).toBeCloseTo(0, 5)
    expect(positions[1]).toBeCloseTo(1, 5)
    expect(positions[2]).toBeCloseTo(0, 5)
  })

  it('preserves the input radius for the projected centroid', () => {
    // Three points on a sphere of radius 1.001 - centroid should also be at 1.001.
    const r = 1.001
    const vertices = [
      new THREE.Vector3(r, 0, 0),
      new THREE.Vector3(0, r, 0),
      new THREE.Vector3(-r, 0, 0),
    ]
    const { positions } = triangulatePolygonFan(vertices)
    // positions is a Float32Array; slice gives a plain number[]-like array
    // avoiding noisy non-null-assertion lint warnings on typed array index access.
    const [cx = 0, cy = 0, cz = 0] = positions
    const centroidLength = Math.sqrt(cx * cx + cy * cy + cz * cz)
    expect(centroidLength).toBeCloseTo(r, 5)
  })
})
