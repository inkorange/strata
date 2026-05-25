'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Tier } from '@/src/lib/tier'
import { useStore } from '@/src/store'

const OPTIONS: { value: Tier | null; label: string; help: string }[] = [
  { value: null, label: 'Auto', help: 'Pick the best tier for this device.' },
  { value: 'mobile-lite', label: 'Lite', help: 'Battery-friendly, lower fidelity.' },
  { value: 'balanced', label: 'Balanced', help: 'Mid-fidelity, smooth on laptops.' },
  { value: 'desktop-ultra', label: 'Ultra', help: 'Full fidelity, capable GPUs only.' },
]

export function TierToggle() {
  const [mounted, setMounted] = useState(false)
  const tierOverride = useStore((s) => s.tierOverride)
  const setTierOverride = useStore((s) => s.setTierOverride)

  // Defer reading the persisted store value until after hydration to avoid
  // an SSR/client mismatch on aria-checked (server renders null, client
  // has the rehydrated value).
  useEffect(() => setMounted(true), [])
  const displayedOverride = mounted ? tierOverride : null

  return (
    <div
      role="radiogroup"
      aria-label="Render tier"
      className="flex items-center gap-1 rounded-md border border-border/60 bg-card/70 p-0.5 text-xs backdrop-blur"
    >
      {OPTIONS.map((opt) => {
        const active = (opt.value ?? null) === displayedOverride
        return (
          // biome-ignore lint/a11y/useSemanticElements: segmented-control pattern; <button role="radio"> inside radiogroup is valid ARIA
          <button
            key={opt.label}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.help}
            onClick={() => setTierOverride(opt.value)}
            className={cn(
              'rounded px-2 py-1 text-foreground/80 transition',
              active ? 'bg-foreground/15 text-foreground' : 'hover:bg-foreground/5',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
