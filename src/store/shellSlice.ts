import type { StateCreator } from 'zustand'
import { detectTier, type Tier } from '@/src/lib/tier'

export type ModuleId = 'hub' | 'tectonics' | 'atmosphere' | 'systems'

export interface ShellSlice {
  /** Detected tier from device probe. Set on the client during boot. */
  tier: Tier
  /** Manual override from the tier toggle. null = use detected. */
  tierOverride: Tier | null
  /** Active module — drives the camera dolly and the module frame mount. */
  activeModule: ModuleId
  /** High-contrast accessibility toggle. */
  highContrast: boolean

  /** Returns tierOverride if set, else tier. */
  effectiveTier: () => Tier

  setTier: (tier: Tier) => void
  setTierOverride: (tier: Tier | null) => void
  setActiveModule: (module: ModuleId) => void
  toggleHighContrast: () => void
}

export const createShellSlice: StateCreator<ShellSlice> = (set, get) => ({
  tier: detectTier(),
  tierOverride: null,
  activeModule: 'hub',
  highContrast: false,

  effectiveTier: () => {
    const { tier, tierOverride } = get()
    return tierOverride ?? tier
  },

  setTier: (tier) => set({ tier }),
  setTierOverride: (tierOverride) => set({ tierOverride }),
  setActiveModule: (activeModule) => set({ activeModule }),
  toggleHighContrast: () => set((state) => ({ highContrast: !state.highContrast })),
})
