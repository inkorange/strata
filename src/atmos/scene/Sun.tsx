'use client'

import { useMemo } from 'react'
import * as THREE from 'three'

const SUN_DISTANCE = 22
const SUN_CORE_RADIUS = 0.55
const SUN_CORONA_SCALE = 6.0
const SUN_POSITION: [number, number, number] = [SUN_DISTANCE, 0, 0]

/**
 * Core-sphere vertex shader: pass the world-space normal and view direction
 * to the fragment shader. Both are needed for the soft silhouette term.
 */
const vertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

/**
 * Fragment shader: uniform pale-yellow HDR-bright disc with a soft
 * silhouette edge. We DELIBERATELY do not brighten the limb — that would
 * make the silhouette the brightest pixel of the entire mesh and the bloom
 * pass would latch onto its outline as a hard disc-shaped glow. Instead,
 * brightness is uniform across the disc and fades to zero in the last ~8%
 * near the silhouette so the bloom blurs a smoothly fading source.
 */
const fragmentShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
uniform vec3 uColor;
uniform float uIntensity;
void main() {
  float ndv = clamp(dot(vNormal, vViewDir), 0.0, 1.0);
  float silhouette = smoothstep(0.0, 0.08, ndv);
  gl_FragColor = vec4(uColor * uIntensity * silhouette, silhouette);
}
`

/**
 * Build a soft radial-gradient corona texture in a 2D canvas. The smooth
 * multi-stop falloff (bright pale yellow → warm amber → near-transparent
 * red → fully transparent black) gives the sprite a real "haze fading
 * into space" feel rather than a visible disc-shaped boundary.
 */
function makeCoronaTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)
  const cx = size / 2
  const cy = size / 2
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2)
  grad.addColorStop(0.0, 'rgba(255, 250, 220, 1.0)')
  grad.addColorStop(0.05, 'rgba(255, 240, 180, 0.85)')
  grad.addColorStop(0.14, 'rgba(255, 200, 130, 0.45)')
  grad.addColorStop(0.28, 'rgba(255, 150, 80, 0.18)')
  grad.addColorStop(0.45, 'rgba(255, 100, 50, 0.06)')
  grad.addColorStop(0.7, 'rgba(255, 70, 30, 0.018)')
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * Visible sun for the Atmosphere module — heliocentric model.
 *
 * The sun is FIXED in world space at +X · SUN_DISTANCE. Earth rotates
 * around its tilted axis (driven by `hour` via the EarthFrame in
 * PersistentScene) to produce day/night; the sun itself does not move.
 *
 * Visually composed of two pieces:
 *   1. A small bright shader-driven core sphere with a soft silhouette.
 *      Its HDR brightness (>1 linear) triggers the scene's bloom pass.
 *   2. A large additive billboard corona with a radial-gradient texture,
 *      handling the smooth glow falloff into space independently of bloom.
 *      Because the gradient itself fades to transparent, there's no
 *      visible boundary — just a slow fade into blackness.
 *
 * Directional light intensity 4.0 dominates the scene's ambient +
 * environment fill so the day/night terminator on Earth reads sharply.
 */
export function Sun() {
  // Used to be gated by `activeModule === 'atmosphere'` so the sun only
  // appeared in the atmosphere module. The sun is now visible on the hub
  // and on every module's Earth view, so the gate is gone — the same
  // heliocentric mechanics apply everywhere.
  const coronaTex = useMemo(() => makeCoronaTexture(), [])
  const coreMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uColor: { value: new THREE.Color('#fff8e0') },
          uIntensity: { value: 3.5 },
        },
        transparent: true,
        depthWrite: false,
        toneMapped: true,
      }),
    [],
  )

  return (
    <group>
      <directionalLight position={SUN_POSITION} intensity={4.0} color="#fff4d6" />

      {/* Soft corona — billboard sprite handles the smooth fade. */}
      <sprite position={SUN_POSITION} scale={[SUN_CORONA_SCALE, SUN_CORONA_SCALE, 1]}>
        <spriteMaterial
          map={coronaTex}
          color="#ffffff"
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.9}
        />
      </sprite>

      {/* Bright HDR core — bloom catches this and smears it further. */}
      <mesh position={SUN_POSITION} material={coreMaterial}>
        <sphereGeometry args={[SUN_CORE_RADIUS, 48, 48]} />
      </mesh>
    </group>
  )
}
