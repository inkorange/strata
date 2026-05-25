'use client'

import {
  Bloom,
  DepthOfField,
  EffectComposer,
  SSAO,
  Vignette,
} from '@react-three/postprocessing'
import { useStore } from '@/src/store'
import { PRESETS } from './presets'

/**
 * Post-processing chain. ACES tone mapping is set on the renderer in
 * Scene.tsx (not as an Effect). Bloom always on. SSAO + DOF + Vignette
 * gate by tier per DESIGN.md §3.
 *
 * Note: <EffectComposer> must be mounted INSIDE the Canvas. It is
 * exported as a separate component so callers can colocate it with
 * scene contents.
 */
export function PostProcessing() {
  const effectiveTier = useStore((s) => s.effectiveTier())
  const preset = PRESETS[effectiveTier]
  const { bloom, ssao, dof, vignette } = preset.postFx

  return (
    <EffectComposer multisampling={preset.shadowMapSize > 0 ? 4 : 0}>
      <>
        {bloom && (
          <Bloom intensity={0.35} luminanceThreshold={1.1} luminanceSmoothing={0.1} mipmapBlur />
        )}
        {ssao && <SSAO radius={0.12} intensity={20} luminanceInfluence={0.6} />}
        {dof && <DepthOfField focusDistance={0.02} focalLength={0.05} bokehScale={2.5} />}
        {vignette && <Vignette eskil={false} offset={0.2} darkness={0.55} />}
      </>
    </EffectComposer>
  )
}
