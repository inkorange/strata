'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useStore } from '@/src/store'
import { SiteFooter } from '@/src/ui/SiteFooter'
import { TopNav } from '@/src/ui/TopNav'
import { TutorPanel } from '@/src/ui/TutorPanel'
import { MODULES } from './modules'

export function HubPage() {
  const setActiveModule = useStore((s) => s.setActiveModule)

  // Reset the shared store's activeModule whenever the user lands on the
  // hub route. The store persists activeModule to localStorage, so without
  // this effect a returning visitor whose last session was a module would
  // still see that module's overlays (cells, cloud band, etc.) on the
  // homepage. Module pages call setActiveModule via ClientShellInit; the
  // hub needs its own.
  useEffect(() => {
    setActiveModule('hub')
  }, [setActiveModule])

  return (
    <main className="pointer-events-none relative h-dvh w-dvw overflow-hidden">
      <TopNav />

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
            className="group min-w-[180px] rounded-xl border border-white/[0.08] bg-[#0d0a1f]/95 px-5 py-4 backdrop-blur-xl transition hover:border-white/20 hover:bg-[#15102e]/95 sm:min-w-0 sm:shadow-[0_6px_24px_rgba(0,0,0,0.45)]"
          >
            <div className="mb-3 flex items-center gap-2">
              <div
                className="h-[3px] w-10 rounded-full"
                style={{
                  backgroundColor: mod.accentHex,
                  boxShadow: `0 0 12px ${mod.accentHex}55`,
                }}
                aria-hidden
              />
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: mod.accentHex }}
              >
                Module
              </div>
            </div>
            <div className="text-base font-semibold tracking-tight text-white">{mod.label}</div>
            <div className="mt-1.5 text-[13px] leading-relaxed text-white/70">{mod.blurb}</div>
          </Link>
        ))}
      </nav>

      <TutorPanel />
      <SiteFooter />
    </main>
  )
}
