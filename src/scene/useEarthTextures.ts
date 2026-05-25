'use client'

import { useTexture } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { PRESETS } from './presets'

const PATHS = {
  day: '/textures/earth_daymap.jpg',
  night: '/textures/earth_night.jpg',
  clouds: '/textures/earth_clouds.jpg',
  normal: '/textures/earth_normal.jpg',
  roughness: '/textures/earth_roughness.jpg',
}

/**
 * Loads the five Earth texture maps with mipmaps and per-tier anisotropy.
 * Day/night/clouds use sRGB color space (they were authored as color
 * imagery). Normal/roughness use linear (they encode data, not color).
 */
export function useEarthTextures() {
  const effectiveTier = useStore((s) => s.effectiveTier())
  const preset = PRESETS[effectiveTier]

  const textures = useTexture({
    day: PATHS.day,
    night: PATHS.night,
    clouds: PATHS.clouds,
    normal: PATHS.normal,
    roughness: PATHS.roughness,
  })

  return useMemo(() => {
    textures.day.colorSpace = THREE.SRGBColorSpace
    textures.night.colorSpace = THREE.SRGBColorSpace
    textures.clouds.colorSpace = THREE.SRGBColorSpace
    textures.normal.colorSpace = THREE.NoColorSpace
    textures.roughness.colorSpace = THREE.NoColorSpace

    for (const tex of Object.values(textures)) {
      tex.anisotropy = preset.anisotropy
      tex.generateMipmaps = true
      tex.minFilter = THREE.LinearMipMapLinearFilter
      tex.magFilter = THREE.LinearFilter
    }

    return textures
  }, [textures, preset.anisotropy])
}
