'use client'

import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import type * as THREE from 'three'
import { latLngToVec3, slerpOnSphere } from '../sphericalGeometry'

const OUTLINE_RADIUS = 1.005 // sit slightly above the Earth surface (1.0) — no z-fighting
const SEGMENTS_PER_EDGE = 12 // smoothness of each edge's great-circle arc

interface PlateProps {
  /** Plate vertices as [lat, lng] degree pairs. */
  vertices: ReadonlyArray<readonly [number, number]>
  color: string
}

/**
 * Renders a single plate as a closed great-circle outline on the sphere
 * surface. Each consecutive pair of boundary vertices is connected via a
 * SLERP-sampled arc of SEGMENTS_PER_EDGE segments, so the outline follows
 * the sphere's curvature instead of cutting chords through the interior.
 *
 * Uses drei's <Line> (MeshLine-backed) so width is real screen pixels
 * regardless of camera distance. Three.js's built-in line geometry caps
 * at 1px which is invisible on a 3D sphere.
 */
export function Plate({ vertices, color }: PlateProps) {
  const points = useMemo<THREE.Vector3[]>(() => {
    if (vertices.length === 0) return []
    // Convert each boundary vertex to a UNIT vec3 first; slerpOnSphere
    // expects unit-sphere inputs. We scale to OUTLINE_RADIUS after.
    const unitVerts = vertices.map(([lat, lng]) => latLngToVec3(lat, lng, 1))

    const pts: THREE.Vector3[] = []
    for (let i = 0; i < unitVerts.length; i++) {
      const a = unitVerts[i] as THREE.Vector3
      const b = unitVerts[(i + 1) % unitVerts.length] as THREE.Vector3
      for (let j = 0; j < SEGMENTS_PER_EDGE; j++) {
        const t = j / SEGMENTS_PER_EDGE
        const p = slerpOnSphere(a, b, t)
        p.multiplyScalar(OUTLINE_RADIUS)
        pts.push(p)
      }
    }
    // Close the loop by repeating the first point.
    const first = pts[0]
    if (first) pts.push(first.clone())
    return pts
  }, [vertices])

  if (points.length === 0) return null

  return <Line points={points} color={color} lineWidth={2.5} transparent opacity={0.95} />
}
