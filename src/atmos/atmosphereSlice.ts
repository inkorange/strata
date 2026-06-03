import type { StateCreator } from 'zustand'
import type { Season } from './solar'

export type LatLng = readonly [number, number]

export interface ScreenPoint {
  /** Page-space x in CSS pixels (clientX). */
  x: number
  /** Page-space y in CSS pixels (clientY). */
  y: number
}

export interface AtmosphereSlice {
  /** UTC clock time, continuous in [0, 24). */
  hour: number
  /** Layer visibility. All three default to true. */
  layers: { cells: boolean; temp: boolean; clouds: boolean }
  /** Hovered/tapped point on the globe; null = no inspect. */
  inspectAt: LatLng | null
  /** Screen-space position of the inspect cursor, used to anchor the
   *  readout next to the click/hover point. Null whenever inspectAt is. */
  inspectScreen: ScreenPoint | null
  /** Day-cycle playback. When true the Timeline advances `hour` continuously. */
  playing: boolean
  /** Earth's orbital position. Drives subsolar latitude, axial-tilt
   *  direction, and the seasonal shift of the cloud band, heatmap, and
   *  wind belts. Defaults to 'equinox'. */
  season: Season

  setHour: (h: number) => void
  toggleLayer: (k: keyof AtmosphereSlice['layers']) => void
  setInspectAt: (p: LatLng | null) => void
  setInspectScreen: (s: ScreenPoint | null) => void
  togglePlaying: () => void
  setSeason: (s: Season) => void
}

const HOUR_EPSILON = 1e-3

export const createAtmosphereSlice: StateCreator<AtmosphereSlice> = (set) => ({
  hour: 12,
  layers: { cells: true, temp: true, clouds: true },
  inspectAt: null,
  inspectScreen: null,
  playing: false,
  season: 'equinox',

  setHour: (h) => {
    const clamped = Math.min(24 - HOUR_EPSILON, Math.max(0, h))
    set({ hour: clamped })
  },

  toggleLayer: (k) =>
    set((state) => ({
      layers: { ...state.layers, [k]: !state.layers[k] },
    })),

  setInspectAt: (p) => set({ inspectAt: p }),

  setInspectScreen: (s) => set({ inspectScreen: s }),

  togglePlaying: () => set((state) => ({ playing: !state.playing })),

  setSeason: (s) => set({ season: s }),
})
