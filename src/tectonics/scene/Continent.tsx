'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { triangulatePolygonOnSphere } from '../sphericalGeometry'

const CONTINENT_RADIUS = 1.003
// Subdivision levels for chord-plane sag reduction. 2 is enough for the
// post-earcut triangle sizes coming out of country-scale polygons (~5-15°
// edges); the previous fan triangulation needed 3 because it had much
// larger initial triangles spanning from the centroid.
const SUBDIVISION_LEVELS = 2

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
        const { positions, indices } = triangulatePolygonOnSphere(
          piece,
          CONTINENT_RADIUS,
          SUBDIVISION_LEVELS,
        )
        if (indices.length === 0) return null
        const geom = new THREE.BufferGeometry()
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geom.setIndex(new THREE.BufferAttribute(indices, 1))
        // Radial outward normals. Every vertex sits on the sphere, so its
        // outward direction is its own normalized position. computeVertexNormals
        // would average face normals at shared vertices, which makes the
        // triangulation edges show up as visible facet lines under the
        // directional light.
        const normals = new Float32Array(positions.length)
        for (let v = 0; v < positions.length; v += 3) {
          const x = positions[v] ?? 0
          const y = positions[v + 1] ?? 0
          const z = positions[v + 2] ?? 0
          const len = Math.hypot(x, y, z) || 1
          normals[v] = x / len
          normals[v + 1] = y / len
          normals[v + 2] = z / len
        }
        geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
        return { geom, key: `p${i}-v${piece.length}` }
      })
      .filter((p): p is { geom: THREE.BufferGeometry; key: string } => p !== null)
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
          />
        </mesh>
      ))}
    </group>
  )
}
