'use client'

import * as THREE from 'three'
import { useStore } from '@/src/store'

const OCEAN_RADIUS = 1.0005 // just above the Earth surface (1.0); hides the photoreal textures

/**
 * Dark ocean sphere overlay rendered only when activeModule === 'tectonics'.
 * Hides the photoreal Earth's day/night/cloud textures so the plate fills
 * become the visible landmass without modern continents bleeding through.
 *
 * Lives in src/tectonics/ because it's a Tectonics-mode-specific element;
 * Earth.tsx stays a generic shared component used by all modules.
 */
export function TectonicsOcean() {
  const activeModule = useStore((s) => s.activeModule)
  if (activeModule !== 'tectonics') return null

  return (
    <mesh>
      <sphereGeometry args={[OCEAN_RADIUS, 96, 96]} />
      <meshStandardMaterial
        color="#0a1f33"
        roughness={0.95}
        metalness={0.05}
        emissive={new THREE.Color('#0a1f33')}
        emissiveIntensity={0.2}
      />
    </mesh>
  )
}
