'use client'

import { Plates } from '@/src/tectonics/scene/Plates'
import { CameraDolly } from './CameraDolly'
import { Earth } from './Earth'
import { PostProcessing } from './PostProcessing'
import { Scene } from './Scene'

/**
 * One scene mount that lives in the root layout. Stays mounted across
 * route changes - navigation only toggles which UI overlays render on
 * top. CameraDolly reads activeModule from the store and tweens between
 * positions on its own; no Canvas remount, no WebGL context teardown.
 */
export function PersistentScene() {
  return (
    <div className="fixed inset-0 -z-10">
      <Scene controls={true}>
        <Earth />
        <CameraDolly />
        <PostProcessing />
        <Plates />
      </Scene>
    </div>
  )
}
