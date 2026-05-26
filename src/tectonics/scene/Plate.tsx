'use client'

import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import type * as THREE from 'three'
import { latLngToVec3, slerpOnSphere } from '../sphericalGeometry'

const OUTLINE_RADIUS = 1.008
const SEGMENTS_PER_EDGE = 12

interface PlateProps {
  vertices: ReadonlyArray<readonly [number, number]>
  color: string
}

export function Plate({ vertices, color }: PlateProps) {
  const outlinePoints = useMemo<THREE.Vector3[]>(() => {
    if (vertices.length === 0) return []
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
    const first = pts[0]
    if (first) pts.push(first.clone())
    return pts
  }, [vertices])

  if (outlinePoints.length === 0) return null

  return <Line points={outlinePoints} color={color} lineWidth={2.5} transparent opacity={0.9} />
}
