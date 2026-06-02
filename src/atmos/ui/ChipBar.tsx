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
 * Three floating layer-toggle chips, centered above the Timeline scrubber.
 * Active chip uses the atmosphere accent fill; inactive chips render as
 * transparent with a muted border. Each chip toggles its store layer key.
 */
export function ChipBar() {
  const layers = useStore((s) => s.layers)
  const toggleLayer = useStore((s) => s.toggleLayer)

  return (
    <div className="pointer-events-auto fixed left-1/2 -translate-x-1/2 z-20 flex gap-2 sm:bottom-20 bottom-28">
      {CHIPS.map(({ key, label }) => {
        const active = layers[key]
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggleLayer(key)}
            aria-pressed={active}
            className={cn(
              'rounded-full px-4 py-2 text-xs font-medium transition-colors border backdrop-blur',
              active
                ? 'text-[#5cc6ff] border-[#5cc6ff] bg-[rgba(92,198,255,0.18)]'
                : 'text-muted-foreground border-border/60 bg-card/60 hover:bg-card/80',
            )}
            style={active ? { boxShadow: `0 0 12px ${ACCENT}33` } : undefined}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
