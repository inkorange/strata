'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { PRESETS } from './presets'

const VERTEX = `
varying vec3 vWorldPosition;
varying vec3 vNormal;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

// Cheap Rayleigh-ish color (blue along the limb, warmer toward the terminator).
// Not physically accurate scattering — close enough to read as "Earth atmosphere"
// at a hub scale. Inspired by drei's <atmosphereMaterial> and the standard
// Three.js fresnel shader.
const FRAGMENT = `
varying vec3 vWorldPosition;
varying vec3 vNormal;
uniform vec3 uSunDirection;
uniform vec3 uColorDay;
uniform vec3 uColorSunset;
uniform float uIntensity;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.5);

  // Sun-facing factor: 1 at noon, 0 at night side; warms the rim near terminator.
  float sunDot = clamp(dot(normalize(vNormal), normalize(uSunDirection)), -0.2, 1.0);
  float terminator = smoothstep(0.0, 0.4, abs(sunDot)) * (1.0 - sunDot);

  vec3 color = mix(uColorDay, uColorSunset, terminator);
  float alpha = fresnel * uIntensity * smoothstep(-0.3, 0.4, sunDot);
  gl_FragColor = vec4(color, alpha);
}
`

interface AtmosphereRimProps {
  radius?: number
}

export function AtmosphereRim({ radius = 1.06 }: AtmosphereRimProps) {
  const effectiveTier = useStore((s) => s.effectiveTier())
  const preset = PRESETS[effectiveTier]

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(5, 3, 5).normalize() },
        uColorDay: { value: new THREE.Color('#5cc6ff') },
        uColorSunset: { value: new THREE.Color('#ff8c5a') },
        uIntensity: { value: preset.atmosphere.raymarched ? 0.85 : 0.65 },
      },
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [preset.atmosphere.raymarched])

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  return (
    <mesh scale={radius}>
      <sphereGeometry args={[1, preset.earth.segments, preset.earth.segments]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
