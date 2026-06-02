'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CELL_BANDS, allArrowArcs, type CellBand } from '@/src/atmos/cellBands'
import { usePrefersReducedMotion } from '@/src/lib/accessibility'
import { useStore } from '@/src/store'

const TUBE_RADIUS = 0.006
const TUBE_LIFT = 1.012 // arrows ride slightly above the Earth surface
const TUBE_SEGMENTS_ALONG = 32
const TUBE_RADIAL_SEGMENTS = 6

const HEAD_LENGTH = 0.025
const HEAD_RADIUS = 0.012

const BAND_COLORS: Record<CellBand['belt'], string> = {
  trade: '#5cc6ff',
  westerly: '#7ad9aa',
  polar: '#aa8fff',
}

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uPhase;
uniform float uVisible;
// Dash pattern in UV.y space. dash + gap = period.
const float DASH = 0.06;
const float GAP  = 0.06;
const float PERIOD = DASH + GAP;
void main() {
  float v = mod(vUv.y - uPhase, PERIOD);
  float onDash = step(v, DASH);
  if (onDash < 0.5) discard;
  gl_FragColor = vec4(uColor, uVisible);
}
`

interface BandMeshData {
  band: CellBand
  geometry: THREE.BufferGeometry
  headGeometry: THREE.BufferGeometry
  material: THREE.ShaderMaterial
  headMaterial: THREE.MeshBasicMaterial
}

function buildBandMeshes(): BandMeshData[] {
  const arcs = allArrowArcs()
  const byBandId = new Map<CellBand['id'], BandMeshData>()

  for (const band of CELL_BANDS) {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(BAND_COLORS[band.belt]) },
        uPhase: { value: 0 },
        uVisible: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
    })
    const headMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(BAND_COLORS[band.belt]),
      transparent: true,
      opacity: 1,
    })
    byBandId.set(band.id, {
      band,
      geometry: new THREE.BufferGeometry(),
      headGeometry: new THREE.BufferGeometry(),
      material,
      headMaterial,
    })
  }

  // Build tubes + cones per arrow, then merge per band.
  const tubesByBand = new Map<CellBand['id'], THREE.BufferGeometry[]>()
  const conesByBand = new Map<CellBand['id'], THREE.BufferGeometry[]>()

  for (const arc of arcs) {
    const points = arc.points.map((p) => p.clone().multiplyScalar(TUBE_LIFT))
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
    const tube = new THREE.TubeGeometry(
      curve,
      TUBE_SEGMENTS_ALONG,
      TUBE_RADIUS,
      TUBE_RADIAL_SEGMENTS,
      false,
    )
    if (!tubesByBand.has(arc.band.id)) tubesByBand.set(arc.band.id, [])
    tubesByBand.get(arc.band.id)!.push(tube)

    // Arrowhead at the end of the curve. Tangent at t=1 is from points[n-2] → points[n-1].
    const end = points[points.length - 1]!
    const beforeEnd = points[points.length - 2]!
    const tangent = end.clone().sub(beforeEnd).normalize()
    const cone = new THREE.ConeGeometry(HEAD_RADIUS, HEAD_LENGTH, 12, 1, false)
    // ConeGeometry's tip points +Y; rotate so tip aligns with tangent.
    cone.translate(0, HEAD_LENGTH / 2, 0)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent)
    cone.applyQuaternion(q)
    cone.translate(end.x, end.y, end.z)
    if (!conesByBand.has(arc.band.id)) conesByBand.set(arc.band.id, [])
    conesByBand.get(arc.band.id)!.push(cone)
  }

  for (const [bandId, tubes] of tubesByBand.entries()) {
    const merged = mergeGeometries(tubes, false)
    if (!merged) continue
    const data = byBandId.get(bandId)!
    data.geometry.dispose()
    data.geometry = merged
  }
  for (const [bandId, cones] of conesByBand.entries()) {
    const merged = mergeGeometries(cones, false)
    if (!merged) continue
    const data = byBandId.get(bandId)!
    data.headGeometry.dispose()
    data.headGeometry = merged
  }

  return Array.from(byBandId.values())
}

/**
 * Renders the six convection bands' arrows as merged tube geometry.
 *
 * One draw call per band (six total). A shared `uPhase` uniform is
 * advanced in useFrame to scroll the dashed pattern along every tube
 * simultaneously. Per-arrow cones sit at each tube's end as the arrowhead.
 *
 * The `cells` layer toggle is plumbed through `uVisible` and a hide on
 * the cone meshes — toggling off makes everything disappear in one frame.
 */
export function Cells() {
  const visibleCells = useStore((s) => s.layers.cells)
  const prefersReducedMotion = usePrefersReducedMotion()

  const meshes = useMemo(() => buildBandMeshes(), [])

  // Shared dash phase scrolls every tube. ~0.6 cycles per second feels live
  // without being distracting.
  const phaseRef = useRef(0)
  useFrame((_, delta) => {
    if (prefersReducedMotion) return
    phaseRef.current = (phaseRef.current + delta * 0.6) % 1
    for (const m of meshes) {
      m.material.uniforms.uPhase!.value = phaseRef.current
      m.material.uniforms.uVisible!.value = visibleCells ? 1 : 0
      m.headMaterial.opacity = visibleCells ? 1 : 0
    }
  })

  return (
    <group>
      {meshes.map((m) => (
        <group key={m.band.id} visible={visibleCells}>
          <mesh geometry={m.geometry} material={m.material} />
          <mesh geometry={m.headGeometry} material={m.headMaterial} />
        </group>
      ))}
    </group>
  )
}
