'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { MODULES } from '@/src/shell/modules'
import { useStore } from '@/src/store'
import type { ModuleId } from '@/src/store/shellSlice'
import { LogoMark } from './icons/LogoMark'
import { SettingsIcon } from './icons/SettingsIcon'
import { TierToggle } from './TierToggle'

const MODULE_LIST = Object.values(MODULES)

/**
 * Unified top navigation, used on both the hub and module pages.
 *
 * Layout:
 *   [Logo · Strata │ Tectonics · Atmosphere · Earth Systems]   [⚙ Settings]
 *
 * The logo doubles as "back to hub". The current location (hub or module)
 * is highlighted in the tab strip. Module pills wrap with their accent
 * color as a small dot; the active one fills with a glass-on-glass
 * highlight. Settings (the render tier toggle) collapses behind a gear
 * icon by default — click to open the popover.
 *
 * Mobile: the module strip drops to short labels (`shortLabel`); below
 * the `xs` breakpoint, the Strata wordmark hides too so the left island
 * stays under one row of viewport width.
 */
export function TopNav() {
  const setActiveModule = useStore((s) => s.setActiveModule)

  // Highlight from the URL, not the store: pathname is identical on the server
  // and client, so a refresh on a module route stays highlighted. The store's
  // activeModule (which drives the 3D scene) is restored separately via
  // ClientShellInit but isn't reliable for SSR markup on a hard refresh.
  const pathname = usePathname()
  const activeId: ModuleId = pathname === '/' ? 'hub' : (pathname.slice(1) as ModuleId)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement | null>(null)

  // Close the popover on outside click + on Escape.
  useEffect(() => {
    if (!settingsOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (!settingsRef.current?.contains(e.target as Node)) setSettingsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [settingsOpen])

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3 sm:p-4">
      {/* Left island — logo + module tabs */}
      <nav
        className="pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-white/[0.08] bg-[#0d0a1f]/95 p-1 backdrop-blur-xl shadow-[0_6px_24px_rgba(0,0,0,0.45)]"
        aria-label="Primary"
      >
        <TabLink href="/" active={activeId === 'hub'} onClick={() => setActiveModule('hub')}>
          <LogoMark className="h-4 w-4" />
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">Strata</span>
          <span className="text-sm font-semibold tracking-tight sm:hidden">Home</span>
        </TabLink>
        <Divider />
        {MODULE_LIST.map((mod) => (
          <ModulePill
            key={mod.id}
            id={mod.id}
            href={`/${mod.id}`}
            accent={mod.accentHex}
            label={mod.label}
            shortLabel={mod.shortLabel}
            active={activeId === mod.id}
            onClick={() => setActiveModule(mod.id)}
          />
        ))}
      </nav>

      {/* Right island — settings */}
      <div ref={settingsRef} className="pointer-events-auto relative">
        <button
          type="button"
          onClick={() => setSettingsOpen((o) => !o)}
          aria-expanded={settingsOpen}
          aria-controls="topnav-settings-popover"
          aria-label="Settings"
          className={cn(
            'inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#0d0a1f]/95 text-white/85 backdrop-blur-xl shadow-[0_6px_24px_rgba(0,0,0,0.45)] transition-colors hover:bg-[#15102e]/95 hover:text-white',
            settingsOpen && 'bg-[#15102e]/95 text-white',
          )}
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
        {settingsOpen && (
          <div
            id="topnav-settings-popover"
            role="dialog"
            aria-label="Render settings"
            className="absolute right-0 top-12 w-64 origin-top-right rounded-xl border border-white/[0.08] bg-[#0d0a1f]/95 p-3 backdrop-blur-xl shadow-[0_6px_24px_rgba(0,0,0,0.55)]"
          >
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Render tier
            </div>
            <TierToggle />
            <p className="mt-2 text-[11px] leading-snug text-white/55">
              Auto picks the best tier for this device. Lower tiers reduce shader and
              post-processing cost.
            </p>
          </div>
        )}
      </div>
    </header>
  )
}

function TabLink({
  href,
  active,
  onClick,
  children,
}: {
  href: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label="Strata home"
      className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-1.5 text-white/85 transition-colors',
        active ? 'bg-white/[0.08] text-white' : 'hover:bg-white/[0.04] hover:text-white',
      )}
    >
      {children}
    </Link>
  )
}

function ModulePill({
  id,
  href,
  accent,
  label,
  shortLabel,
  active,
  onClick,
}: {
  id: ModuleId
  href: string
  accent: string
  label: string
  shortLabel: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Link
      key={id}
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      // aria-label forces a stable accessible name across viewports so the
      // mobile shortLabel ("Crust") doesn't break tests or screen readers
      // that expect the full module name.
      aria-label={label}
      className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-white/[0.08] text-white'
          : 'text-white/65 hover:bg-white/[0.04] hover:text-white',
      )}
    >
      <span
        aria-hidden
        className="block h-1.5 w-1.5 rounded-full"
        style={{
          backgroundColor: accent,
          boxShadow: active ? `0 0 8px ${accent}` : `0 0 4px ${accent}55`,
        }}
      />
      <span aria-hidden className="hidden font-medium tracking-tight sm:inline">
        {label}
      </span>
      <span aria-hidden className="font-medium tracking-tight sm:hidden">
        {shortLabel}
      </span>
    </Link>
  )
}

function Divider() {
  return <span aria-hidden className="mx-1 inline-block h-5 w-px bg-white/[0.08]" />
}
