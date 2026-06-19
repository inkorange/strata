'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { triangulatePolygonOnSphere } from '../sphericalGeometry'

// Lifted further above the ocean (radius 1.0) than the old continents and
// subdivided more, because the paleo polygons are coarse (few vertices → big
// earcut triangles). Without this, a large triangle's interior bows below the
// ocean sphere (chord sag) and the ocean shows through as dark "flooded" patches.
// Kept below the plate outlines at 1.008.
const LAND_RADIUS = 1.006
const SUBDIVISION_LEVELS = 3

interface LandProps {
  polygons: ReadonlyArray<ReadonlyArray<readonly [number, number]>>
  color: string
  opacity: number
}

/**
 * Renders an era's landmasses as filled meshes on the sphere. Each polygon
 * piece is triangulated independently with radial outward normals (avoids
 * facet lines under the directional light). `opacity` drives the crossfade
 * between eras; geometry is memoized on `polygons` (a stable per-era reference)
 * so opacity changes each frame stay cheap.
 */
export function Land({ polygons, color, opacity }: LandProps) {
  const pieces = useMemo(() => {
    return polygons
      .filter((p) => p.length >= 3)
      .map((piece, i) => {
        const { positions, indices } = triangulatePolygonOnSphere(
          piece,
          LAND_RADIUS,
          SUBDIVISION_LEVELS,
        )
        if (indices.length === 0) return null
        const geom = new THREE.BufferGeometry()
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geom.setIndex(new THREE.BufferAttribute(indices, 1))
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

  if (pieces.length === 0 || opacity <= 0) return null

  // At rest the land is fully OPAQUE so it renders in the opaque pass and the
  // cloud layer (transparent, larger radius, depthWrite:false) draws over it —
  // continents sit under the clouds, as on the real Earth. Only during an
  // era crossfade (opacity < 1) does it go transparent.
  const opaque = opacity >= 1

  return (
    <group>
      {pieces.map(({ geom, key }) => (
        <mesh key={key} geometry={geom}>
          <meshStandardMaterial
            color={color}
            metalness={0.05}
            roughness={0.95}
            transparent={!opaque}
            opacity={opacity}
            depthWrite={opaque}
          />
        </mesh>
      ))}
    </group>
  )
}
