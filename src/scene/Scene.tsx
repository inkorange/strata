'use client'

import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { detectTier } from '@/src/lib/tier'
import { PRESETS } from './presets'
import { Starfield } from './Starfield'

interface SceneProps {
  children: ReactNode
  /** Disables OrbitControls on the hub when CameraDolly is driving. */
  controls?: boolean
}

export function Scene({ children, controls = true }: SceneProps) {
  const effectiveTier = useStore((s) => s.effectiveTier())
  const setTier = useStore((s) => s.setTier)
  const preset = PRESETS[effectiveTier]

  // Re-detect tier on the client after hydration. SSR seeds with 'balanced'.
  useEffect(() => {
    setTier(detectTier())
  }, [setTier])

  const camera = useMemo(() => ({ position: [0, 0, 6] as [number, number, number], fov: 45 }), [])

  return (
    <Canvas
      shadows={preset.shadowMapSize > 0}
      frameloop={preset.frameloop}
      dpr={[1, preset.dprCap]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      onCreated={({ gl }) => {
        if (preset.shadowMapSize > 0) {
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
        }
      }}
      style={{ position: 'absolute', inset: 0, background: '#07051a' }}
    >
      <PerspectiveCamera makeDefault position={camera.position} fov={camera.fov} />

      {/* IBL: HDRI drives ambient + reflections. background=false keeps the
       * deep-space color as the canvas backdrop instead of showing the HDRI. */}
      <Environment files={preset.hdriPath} background={false} environmentIntensity={0.35} />

      {/* Key sun: directional light, casts shadows on capable tiers.
       * Positioned to backlight the Earth from upper-left for a strong
       * day/night terminator. */}
      <directionalLight
        position={[5, 3, 5]}
        intensity={2.2}
        castShadow={preset.shadowMapSize > 0}
        shadow-mapSize={[preset.shadowMapSize || 1024, preset.shadowMapSize || 1024]}
        shadow-bias={-0.0005}
      />
      <ambientLight intensity={0.15} />

      <Starfield />

      {children}

      {controls && (
        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={2.5}
          maxDistance={12}
          autoRotate={false}
        />
      )}
    </Canvas>
  )
}
