'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { latLngToVec3, triangulatePolygonFan } from '../sphericalGeometry'

const CONTINENT_RADIUS = 1.003
const SUBDIVISION_LEVELS = 4

interface ContinentProps {
  vertices: ReadonlyArray<readonly [number, number]>
  color: string
}

/**
 * Renders a single continent as a filled landmass mesh on the sphere.
 * Uses subdivided fan triangulation to keep the interior on the sphere
 * surface (avoid chord-plane sag into the ocean).
 */
export function Continent({ vertices, color }: ContinentProps) {
  const geometry = useMemo(() => {
    if (vertices.length === 0) return null
    const vec3s = vertices.map(([lat, lng]) => latLngToVec3(lat, lng, CONTINENT_RADIUS))
    const { positions, indices } = triangulatePolygonFan(vec3s, SUBDIVISION_LEVELS)
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setIndex(new THREE.BufferAttribute(indices, 1))
    geom.computeVertexNormals()
    return geom
  }, [vertices])

  if (!geometry) return null

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        metalness={0.05}
        roughness={0.95}
        emissive={new THREE.Color(color)}
        emissiveIntensity={0.08}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
