'use client'

import { cn } from '@/lib/utils'
import { useStore } from '@/src/store'

const CHIPS = [
  { key: 'cells', label: 'Cells' },
  { key: 'temp', label: 'Temperature' },
  { key: 'clouds', label: 'Clouds' },
] as const

const ACCENT = '#5cc6ff' // matches --color-accent-atmosphere

/**
 * Layer-toggle pills. Rendered inline as the ModuleFrame `headerAction`,
 * sitting to the right of the "Atmosphere" title. Active chip uses the
 * atmosphere accent fill; inactive chips render as transparent with a
 * muted border. Each chip toggles its store layer key.
 */
export function ChipBar() {
  const layers = useStore((s) => s.layers)
  const toggleLayer = useStore((s) => s.toggleLayer)

  return (
    <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">
      {CHIPS.map(({ key, label }) => {
        const active = layers[key]
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggleLayer(key)}
            aria-pressed={active}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors border',
              active
                ? 'text-[#5cc6ff] border-[#5cc6ff]/70 bg-[rgba(92,198,255,0.18)]'
                : 'text-white/65 border-white/[0.12] bg-white/[0.03] hover:text-white hover:bg-white/[0.06]',
            )}
            style={active ? { boxShadow: `0 0 10px ${ACCENT}33` } : undefined}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
