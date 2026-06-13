'use client'

import { useStore } from '@/src/store'

/**
 * Reset control for the Earth Systems card header. Rendered via ModuleFrame's
 * `headerAction` slot, to the right of the "Earth Systems" title. Restores the
 * active scenario seed (masses, levers, year) and stops playback.
 */
export function SystemsResetButton() {
  const reset = useStore((s) => s.resetSystems)
  return (
    <button
      type="button"
      onClick={() => reset()}
      className="rounded-md border border-white/[0.12] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      Reset
    </button>
  )
}
