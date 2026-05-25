import type { Tier } from '@/src/lib/tier'

export interface Preset {
  /** R3F Canvas frameloop. */
  frameloop: 'always' | 'demand' | 'never'
  /** Real-time shadow texture resolution per cascade. 0 disables shadows. */
  shadowMapSize: 0 | 1024 | 2048 | 4096
  /** Device pixel-ratio cap. Avoids 3x DPR on phones killing fill rate. */
  dprCap: number
  /** Earth sphere tessellation. */
  earth: {
    segments: number
    cloudSegments: number
    /** Render the interior cutaway shells. */
    interior: boolean
  }
  /** Atmospheric rim shader quality. */
  atmosphere: {
    /** Use the GLSL fresnel + Rayleigh shader (true) or a cheaper additive shell (false). */
    raymarched: boolean
  }
  /** Post-processing flags. Bloom is always on; the rest tier-gate. */
  postFx: {
    bloom: boolean
    ssao: boolean
    dof: boolean
    vignette: boolean
  }
  /** Anisotropy passed to texture loaders. */
  anisotropy: number
  /** Path to the IBL HDRI environment map under /public. */
  hdriPath: string
}

const HDRI_PATH = '/textures/env_space_2k.hdr'

export const PRESETS: Record<Tier, Preset> = {
  'desktop-ultra': {
    frameloop: 'always',
    shadowMapSize: 2048,
    dprCap: 2,
    earth: { segments: 256, cloudSegments: 192, interior: true },
    atmosphere: { raymarched: true },
    postFx: { bloom: true, ssao: false, dof: false, vignette: true },
    anisotropy: 16,
    hdriPath: HDRI_PATH,
  },
  balanced: {
    frameloop: 'always',
    shadowMapSize: 1024,
    dprCap: 1.5,
    earth: { segments: 128, cloudSegments: 96, interior: false },
    atmosphere: { raymarched: true },
    postFx: { bloom: true, ssao: false, dof: false, vignette: true },
    anisotropy: 8,
    hdriPath: HDRI_PATH,
  },
  'mobile-lite': {
    frameloop: 'demand',
    shadowMapSize: 0,
    dprCap: 1,
    earth: { segments: 64, cloudSegments: 48, interior: false },
    atmosphere: { raymarched: false },
    postFx: { bloom: true, ssao: false, dof: false, vignette: false },
    anisotropy: 4,
    hdriPath: HDRI_PATH,
  },
}
