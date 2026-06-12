'use client'

import { Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { type ReactNode, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { detectTier } from '@/src/lib/tier'
import { useStore } from '@/src/store'
import { PRESETS } from './presets'
import { Starfield } from './Starfield'

function KTX2Setup() {
  const { gl } = useThree()
  useEffect(() => {
    const ktx2 = new KTX2Loader()
      .setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/libs/basis/')
      .detectSupport(gl)
    THREE.DefaultLoadingManager.addHandler(/\.ktx2$/i, ktx2)
    return () => {
      // No removeHandler API; the loader stays registered for the lifetime
      // of the page, which is what we want anyway.
    }
  }, [gl])
  return null
}

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
      <KTX2Setup />
      <PerspectiveCamera makeDefault position={camera.position} fov={camera.fov} />

      {/* IBL: HDRI drives ambient + reflections. background=false keeps the
       * deep-space color as the canvas backdrop instead of showing the HDRI.
       * Dim across all modules so the dark side reads as truly dark and the
       * Sun's directional light dominates the lit hemisphere. */}
      <Environment files={preset.hdriPath} background={false} environmentIntensity={0.18} />

      {/* No static key light — the <Sun /> component (in PersistentScene)
       * provides the sole moving directional source on every Earth view,
       * for visual consistency across the hub and all modules. */}
      <ambientLight intensity={0.08} />

      <Starfield />

      {children}

      {controls && (
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom
          /* Wide min/max so the CameraDolly's aspect-scaled module positions
             (which can be 7-10 units out in mobile portrait) fit within the
             clamp. min stays at 1.6 so manual zoom can get close to Earth
             without clipping through the surface. */
          minDistance={1.6}
          maxDistance={25}
          /* Camera stays still — the Earth itself spins on its tilted axis
             (driven by `hour` in atmosphere, continuous ambient rotation
             elsewhere), so a camera revolution on top would double the
             apparent motion and make the spin direction ambiguous. The
             user can still orbit manually by dragging. */
          autoRotate={false}
        />
      )}
    </Canvas>
  )
}
