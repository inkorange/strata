'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TopNav } from '@/src/ui/TopNav'
import { TutorPanel } from '@/src/ui/TutorPanel'
import { ClientShellInit } from './ClientShellInit'
import type { ModuleDef } from './modules'

/** Serializable subset of ModuleDef — safe to pass from Server → Client Component. */
export type ModuleFrameData = Omit<ModuleDef, 'Body' | 'HeaderAction'>

interface ModuleFrameProps {
  module: ModuleFrameData
  /** Optional content rendered to the right of the module title in the
   *  card header. Used by modules (atmosphere) that surface compact
   *  module-level toggles alongside the title. */
  headerAction?: ReactNode
  children: ReactNode
}

export function ModuleFrame({ module, headerAction, children }: ModuleFrameProps) {
  return (
    <main className="pointer-events-none relative h-dvh w-dvw overflow-hidden">
      <ClientShellInit module={module} />

      <TopNav />

      {/* Sidebar (desktop) / floating card (mobile). Slightly opaque so the
       * body copy stays readable against the bright scene behind it. Left
       * accent strip carries the module's color, so each module reads as
       * its own context without the title doubling up with the top bar.
       *
       * Mobile: floats above the bottom-anchored Timeline scrubber so the
       * scrubber stays usable, with side margins so it reads as a card
       * rather than an edge-to-edge drawer. Desktop: pinned to the left
       * edge from below the top nav. */}
      <aside
        className={cn(
          'pointer-events-auto absolute z-10 bg-[#0d0a1f]/95 backdrop-blur-xl text-foreground overflow-auto',
          'bottom-20 inset-x-4 max-h-[40dvh] rounded-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
          'sm:bottom-auto sm:top-24 sm:inset-x-auto sm:left-0 sm:right-auto sm:w-80 sm:h-auto sm:max-h-[70dvh]',
          'sm:rounded-l-none sm:rounded-r-xl sm:border-l-0 sm:border-t-0 sm:border-b-0 sm:border-r',
          'sm:shadow-[8px_0_32px_rgba(0,0,0,0.45)]',
        )}
        aria-label="Module controls"
      >
        <div className="relative flex flex-col">
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px] sm:rounded-l-none"
            style={{ backgroundColor: module.accentHex, boxShadow: `0 0 16px ${module.accentHex}40` }}
            aria-hidden
          />
          <header className="border-b border-white/[0.07] px-5 pt-4 pb-3">
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: module.accentHex }}
            >
              Module
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-3">
              <h1 className="text-lg font-semibold text-white tracking-tight">
                {module.label}
              </h1>
              {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
            </div>
          </header>
          <div className="flex-1 px-5 py-4 text-[13px] leading-relaxed text-white/85">
            {children}
          </div>
        </div>
      </aside>

      <TutorPanel />
    </main>
  )
}
