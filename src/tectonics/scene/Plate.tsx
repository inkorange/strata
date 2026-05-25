'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { latLngToVec3, triangulatePolygonFan } from '../sphericalGeometry'

const PLATE_RADIUS = 1.001 // just above the Earth surface (radius 1) to avoid z-fight

interface PlateProps {
  /** Plate vertices as [lat, lng] degree pairs. */
  vertices: ReadonlyArray<readonly [number, number]>
  color: string
}

/**
 * Renders a single plate as a colored mesh on the sphere surface. Re-builds
 * its BufferGeometry every time `vertices` changes; the parent <Plates>
 * passes new tweened vertex arrays each frame during an era transition.
 */
export function Plate({ vertices, color }: PlateProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  // Rebuild geometry whenever vertices change.
  const geometry = useMemo(() => {
    const vec3s = vertices.map(([lat, lng]) => latLngToVec3(lat, lng, PLATE_RADIUS))
    const { positions, indices } = triangulatePolygonFan(vec3s)

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setIndex(new THREE.BufferAttribute(indices, 1))
    geom.computeVertexNormals()
    return geom
  }, [vertices])

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        color={color}
        metalness={0.05}
        roughness={0.85}
        emissive={new THREE.Color(color)}
        emissiveIntensity={0.15}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
