'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { latLngToVec3, triangulatePolygonFan } from '../sphericalGeometry'

const CONTINENT_RADIUS = 1.003
const SUBDIVISION_LEVELS = 3

interface ContinentProps {
  polygons: ReadonlyArray<ReadonlyArray<readonly [number, number]>>
  color: string
}

/**
 * Renders a continent as one or more filled landmass meshes on the sphere.
 * Each polygon piece (mainland, island, etc.) is triangulated independently.
 * Uses subdivided fan triangulation to keep the interior on the sphere
 * surface (avoid chord-plane sag into the ocean).
 *
 * Subdivision is reduced from 4 to 3 because multipolygon continents carry
 * many more total polygons — keeping rendering cost under control.
 */
export function Continent({ polygons, color }: ContinentProps) {
  const pieces = useMemo(() => {
    return polygons
      .filter((p) => p.length >= 3)
      .map((piece, i) => {
        const vec3s = piece.map(([lat, lng]) => latLngToVec3(lat, lng, CONTINENT_RADIUS))
        const { positions, indices } = triangulatePolygonFan(vec3s, SUBDIVISION_LEVELS)
        const geom = new THREE.BufferGeometry()
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geom.setIndex(new THREE.BufferAttribute(indices, 1))
        geom.computeVertexNormals()
        // Use vertex count + piece index as stable key — piece ordering is fixed
        // by the data pipeline (largest piece first) and never reorders at runtime.
        return { geom, key: `p${i}-v${piece.length}` }
      })
  }, [polygons])

  if (pieces.length === 0) return null

  return (
    <group>
      {pieces.map(({ geom, key }) => (
        <mesh key={key} geometry={geom}>
          <meshStandardMaterial
            color={color}
            metalness={0.05}
            roughness={0.95}
            emissive={new THREE.Color(color)}
            emissiveIntensity={0.08}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
