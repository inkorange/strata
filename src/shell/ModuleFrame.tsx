'use client'

import type { ReactNode } from 'react'
import { CameraDolly } from '@/src/scene/CameraDolly'
import { Earth } from '@/src/scene/Earth'
import { PostProcessing } from '@/src/scene/PostProcessing'
import { Scene } from '@/src/scene/Scene'
import { BackToHub } from '@/src/ui/BackToHub'
import { TierToggle } from '@/src/ui/TierToggle'
import { TutorPanel } from '@/src/ui/TutorPanel'
import { ClientShellInit } from './ClientShellInit'
import type { ModuleDef } from './modules'

/** Serializable subset of ModuleDef — safe to pass from Server → Client Component. */
export type ModuleFrameData = Omit<ModuleDef, 'Body'>

interface ModuleFrameProps {
  module: ModuleFrameData
  children: ReactNode
}

export function ModuleFrame({ module, children }: ModuleFrameProps) {
  return (
    <main className="relative h-dvh w-dvw overflow-hidden">
      <ClientShellInit module={module} />

      <div className="absolute inset-0">
        <Scene controls={false}>
          <Earth />
          <CameraDolly />
          <PostProcessing />
        </Scene>
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 sm:p-6">
        <div className="pointer-events-auto flex items-center gap-3">
          <BackToHub />
          <div
            className="h-4 w-0.5 rounded"
            style={{ backgroundColor: module.accentHex }}
            aria-hidden
          />
          <span className="text-sm font-medium text-foreground">{module.label}</span>
        </div>
        <div className="pointer-events-auto">
          <TierToggle />
        </div>
      </header>

      {/* Sidebar (desktop) / bottom drawer (mobile) — empty for now; the
       * module's controls will land here once the simulation engine is wired. */}
      <aside
        className="pointer-events-auto absolute z-10 bg-card/60 backdrop-blur
          bottom-0 inset-x-0 max-h-[35dvh] overflow-auto border-t border-border/40
          sm:bottom-auto sm:inset-y-0 sm:left-0 sm:right-auto sm:w-72 sm:max-h-none
          sm:border-r sm:border-t-0"
        aria-label="Module controls"
      >
        <div className="flex h-full flex-col">
          <header className="border-b border-border/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Controls
          </header>
          <div className="flex-1 p-4 text-sm text-muted-foreground">{children}</div>
        </div>
      </aside>

      <TutorPanel />
    </main>
  )
}
