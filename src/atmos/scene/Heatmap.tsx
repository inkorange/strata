'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'

const HEATMAP_RADIUS = 1.005

const vertexShader = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const fragmentShader = /* glsl */ `
varying vec3 vWorldPos;
uniform float uVisible;

// 5-stop latitude ramp: red (eq) → orange → yellow-cyan → cyan → deep blue
vec3 ramp(float t) {
  vec3 red    = vec3(0.95, 0.30, 0.15);
  vec3 orange = vec3(0.98, 0.55, 0.20);
  vec3 yellow = vec3(0.95, 0.85, 0.45);
  vec3 cyan   = vec3(0.45, 0.78, 0.92);
  vec3 deep   = vec3(0.18, 0.32, 0.65);
  if (t < 0.33) return mix(red, orange, t / 0.33);
  if (t < 0.66) return mix(orange, yellow, (t - 0.33) / 0.33);
  if (t < 0.85) return mix(yellow, cyan, (t - 0.66) / 0.19);
  return mix(cyan, deep, (t - 0.85) / 0.15);
}

void main() {
  vec3 n = normalize(vWorldPos);
  float absLat = abs(asin(clamp(n.y, -1.0, 1.0))) / 1.5707963; // 0 at eq, 1 at pole
  vec3 c = ramp(absLat);
  // Alpha: visible band, fades at the poles to avoid a hard cap
  float a = uVisible * 0.32 * (1.0 - smoothstep(0.85, 1.0, absLat));
  gl_FragColor = vec4(c, a);
}
`

/**
 * Surface temperature heatmap as an additive sphere shell slightly above
 * the Earth surface. Latitude-only gradient — no per-frame state, no time
 * dependence. The `temp` layer toggle drives the `uVisible` uniform; we
 * lerp toward 0 in the shader so toggling fades the layer rather than
 * popping it.
 */
export function Heatmap() {
  const visible = useStore((s) => s.layers.temp)

  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uVisible: { value: visible ? 1 : 0 } },
      transparent: true,
      depthWrite: false,
    })
    return m
  }, []) // material persists across visibility flips; we update the uniform below

  // Sync uVisible whenever the layer toggle changes.
  material.uniforms.uVisible!.value = visible ? 1 : 0

  return (
    <mesh material={material}>
      <sphereGeometry args={[HEATMAP_RADIUS, 96, 96]} />
    </mesh>
  )
}
