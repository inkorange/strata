'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { subsolarLatForSeason } from '@/src/atmos/solar'
import { useStore } from '@/src/store'

/** Fraction of subsolar latitude the heatmap's "hot zone" shifts by. The
 *  ITCZ doesn't follow the subsolar point all the way to the tropic
 *  during solstice — the moist convection band lags by roughly half. */
const SEASONAL_HEAT_SHIFT_FRACTION = 0.6

const HEATMAP_RADIUS = 1.005

// Latitude is computed from the LOCAL (model-space) position so the gradient
// stays geographically anchored: the hot band tracks Earth's true equator
// even when the parent EarthFrame is tilted 23.44° off vertical.
const vertexShader = /* glsl */ `
varying vec3 vLocalPos;
void main() {
  vLocalPos = position;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */ `
varying vec3 vLocalPos;
uniform float uVisible;
uniform float uHotLatRad;

// 5-stop latitude ramp: red (hot) → orange → yellow-cyan → cyan → deep blue
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
  vec3 n = normalize(vLocalPos);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  // Distance from the season-shifted "hot latitude" — the gradient peak
  // moves toward the summer hemisphere instead of staying glued to the
  // equator. /π/2 normalises so t∈[0, 1+] over a 90° angular distance.
  float dist = abs(lat - uHotLatRad) / 1.5707963;
  float t = clamp(dist, 0.0, 1.0);
  vec3 c = ramp(t);
  // Alpha: visible band, fades at the poles to avoid a hard cap.
  float a = uVisible * 0.32 * (1.0 - smoothstep(0.85, 1.0, t));
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
  const season = useStore((s) => s.season)

  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uVisible: { value: visible ? 1 : 0 },
        uHotLatRad: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    })
    return m
  }, []) // material persists across visibility flips; we update uniforms below

  // Sync uniforms each render. Seasonal hot-zone lat is a fraction of the
  // subsolar latitude — the convection-driven temperature band lags behind
  // the subsolar point in real Earth, so we apply SEASONAL_HEAT_SHIFT_FRACTION.
  material.uniforms.uVisible!.value = visible ? 1 : 0
  material.uniforms.uHotLatRad!.value =
    (subsolarLatForSeason(season) * SEASONAL_HEAT_SHIFT_FRACTION * Math.PI) / 180

  return (
    <mesh material={material}>
      <sphereGeometry args={[HEATMAP_RADIUS, 96, 96]} />
    </mesh>
  )
}
