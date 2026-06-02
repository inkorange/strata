import type { StateCreator } from 'zustand'

export type LatLng = readonly [number, number]

export interface AtmosphereSlice {
  /** UTC clock time, continuous in [0, 24). */
  hour: number
  /** Layer visibility. All three default to true. */
  layers: { cells: boolean; temp: boolean; clouds: boolean }
  /** Hovered/tapped point on the globe; null = no inspect. */
  inspectAt: LatLng | null

  setHour: (h: number) => void
  toggleLayer: (k: keyof AtmosphereSlice['layers']) => void
  setInspectAt: (p: LatLng | null) => void
}

const HOUR_EPSILON = 1e-3

export const createAtmosphereSlice: StateCreator<AtmosphereSlice> = (set) => ({
  hour: 12,
  layers: { cells: true, temp: true, clouds: true },
  inspectAt: null,

  setHour: (h) => {
    const clamped = Math.min(24 - HOUR_EPSILON, Math.max(0, h))
    set({ hour: clamped })
  },

  toggleLayer: (k) =>
    set((state) => ({
      layers: { ...state.layers, [k]: !state.layers[k] },
    })),

  setInspectAt: (p) => set({ inspectAt: p }),
})
