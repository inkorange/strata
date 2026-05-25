'use client'

import { Earth } from '@/src/scene/Earth'
import { PostProcessing } from '@/src/scene/PostProcessing'
import { Scene } from '@/src/scene/Scene'

export default function Page() {
  return (
    <main className="fixed inset-0">
      <Scene controls>
        <Earth />
        <PostProcessing />
      </Scene>
    </main>
  )
}
