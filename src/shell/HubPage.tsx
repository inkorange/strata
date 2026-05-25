'use client'

import Link from 'next/link'
import { CameraDolly } from '@/src/scene/CameraDolly'
import { Earth } from '@/src/scene/Earth'
import { PostProcessing } from '@/src/scene/PostProcessing'
import { Scene } from '@/src/scene/Scene'
import { useStore } from '@/src/store'
import { SiteFooter } from '@/src/ui/SiteFooter'
import { TierToggle } from '@/src/ui/TierToggle'
import { TutorPanel } from '@/src/ui/TutorPanel'
import { MODULES } from './modules'

export function HubPage() {
  const setActiveModule = useStore((s) => s.setActiveModule)

  return (
    <main className="relative h-dvh w-dvw overflow-hidden">
      {/* Full-bleed canvas behind the UI */}
      <div className="absolute inset-0">
        <Scene controls={false}>
          <Earth />
          <CameraDolly />
          <PostProcessing />
        </Scene>
      </div>

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 sm:p-6">
        <h1 className="pointer-events-auto text-base font-medium tracking-wide text-[#dffaff]">
          Strata
        </h1>
        <div className="pointer-events-auto">
          <TierToggle />
        </div>
      </header>

      {/* Module entry cards — mobile: bottom drawer-style row; desktop: floating right column. */}
      <nav
        className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 flex flex-row gap-2 overflow-x-auto p-4 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-80 sm:flex-col sm:justify-center sm:gap-4 sm:overflow-visible sm:p-6"
        aria-label="Module entry"
      >
        {Object.values(MODULES).map((mod) => (
          <Link
            key={mod.id}
            href={`/${mod.id}`}
            onClick={() => setActiveModule(mod.id)}
            className="group min-w-[160px] rounded-lg border border-border/40 bg-card/60 p-4 backdrop-blur transition hover:border-border hover:bg-card/80 sm:min-w-0"
          >
            <div
              className="mb-2 h-0.5 w-12 rounded"
              style={{ backgroundColor: mod.accentHex }}
              aria-hidden
            />
            <div className="text-sm font-medium text-foreground">{mod.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{mod.blurb}</div>
          </Link>
        ))}
      </nav>

      <TutorPanel />
      <SiteFooter />
    </main>
  )
}
