'use client'

import { useStore } from '@/src/store'
import { PRESETS } from './presets'

interface ShellProps {
  radius: number
  color: string
  emissive?: string
  emissiveIntensity?: number
  roughness?: number
  metalness?: number
}

function Shell({
  radius,
  color,
  emissive = '#000000',
  emissiveIntensity = 0,
  roughness = 0.85,
  metalness = 0.05,
}: ShellProps) {
  return (
    <mesh>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={roughness}
        metalness={metalness}
      />
    </mesh>
  )
}

/**
 * Nested shells: crust > mantle > outer core > inner core. Rendered on
 * desktop-ultra only and made visible during the zoom-to-enter dolly
 * (parent controls scale/clip). At the hub scale these are hidden
 * behind the opaque Earth surface; CameraDolly cuts away to expose
 * them when the user enters a module.
 */
export function EarthInterior() {
  const effectiveTier = useStore((s) => s.effectiveTier())
  const preset = PRESETS[effectiveTier]
  if (!preset.earth.interior) return null

  return (
    <group>
      <Shell radius={0.985} color="#3a2a1a" roughness={0.95} />            {/* crust */}
      <Shell radius={0.92} color="#8b3a14" roughness={0.7} />              {/* mantle */}
      <Shell radius={0.55} color="#ff6a2a" emissive="#ff4a14" emissiveIntensity={0.6} roughness={0.4} metalness={0.6} /> {/* outer core */}
      <Shell radius={0.30} color="#ffd877" emissive="#ffaa44" emissiveIntensity={1.4} roughness={0.25} metalness={0.85} /> {/* inner core */}
    </group>
  )
}
