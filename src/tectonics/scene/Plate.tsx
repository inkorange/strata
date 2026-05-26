'use client'

import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { latLngToVec3, slerpOnSphere, triangulatePolygonFan } from '../sphericalGeometry'

const FILL_RADIUS = 1.002 // sits above the TectonicsOcean at 1.0005
const OUTLINE_RADIUS = 1.006 // sits above the fill so the line shows above the mesh
const SEGMENTS_PER_EDGE = 12
const SUBDIVISION_LEVELS = 4 // recursive triangle subdivision so plate interiors stay on the sphere

interface PlateProps {
  /** Plate vertices as [lat, lng] degree pairs. */
  vertices: ReadonlyArray<readonly [number, number]>
  /** Plate's display color (used for fill; outline is rendered slightly darker). */
  color: string
}

/**
 * Renders a single plate as TWO things on the sphere:
 *   1. A filled subdivided mesh at FILL_RADIUS (the "landmass" of the plate)
 *   2. A closed great-circle outline at OUTLINE_RADIUS (the plate boundary)
 *
 * The fill uses the plate's color (land plates: warm tones; Pacific: ocean
 * blue; Antarctic: pale ice). 4-level recursive triangle subdivision keeps
 * the fill interior on the sphere surface (avoids chord-plane sag dipping
 * inside the Earth).
 *
 * The outline uses a darker shade of the plate's color so the boundary
 * reads clearly against the fill.
 */
export function Plate({ vertices, color }: PlateProps) {
  // Filled landmass mesh
  const fillGeometry = useMemo(() => {
    if (vertices.length === 0) return null
    const vec3s = vertices.map(([lat, lng]) => latLngToVec3(lat, lng, FILL_RADIUS))
    const { positions, indices } = triangulatePolygonFan(vec3s, SUBDIVISION_LEVELS)
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setIndex(new THREE.BufferAttribute(indices, 1))
    geom.computeVertexNormals()
    return geom
  }, [vertices])

  // Outline points (great-circle interpolated, on the sphere surface)
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

  // Outline color: darker variant of fill color for boundary contrast.
  const outlineColor = useMemo(() => {
    const c = new THREE.Color(color)
    c.multiplyScalar(0.45) // darken for clear boundary visibility
    return `#${c.getHexString()}`
  }, [color])

  if (!fillGeometry || outlinePoints.length === 0) return null

  return (
    <>
      {/* Filled landmass */}
      <mesh geometry={fillGeometry}>
        <meshStandardMaterial
          color={color}
          metalness={0.05}
          roughness={0.9}
          emissive={new THREE.Color(color)}
          emissiveIntensity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Outline boundary on top */}
      <Line points={outlinePoints} color={outlineColor} lineWidth={2} transparent opacity={0.9} />
    </>
  )
}
