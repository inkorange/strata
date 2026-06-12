import type { ReservoirKey } from './carbonModel'

/** Clamp (value − min)/(max − min) into [0, 1]. Zero-width range → 0. */
export function normalizeMass(value: number, min: number, max: number): number {
  if (max <= min) return 0
  const t = (value - min) / (max - min)
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/** Per-reservoir [min, max] GtC display windows. Chosen so the visible range of
 *  each gauge/visual spans the masses the sandbox actually produces, keeping
 *  change legible despite reservoirs differing by orders of magnitude. */
export const DISPLAY_RANGES: Record<ReservoirKey, [number, number]> = {
  atmosphere: [400, 1600],
  ocean: [37_000, 40_000],
  biosphere: [1_000, 2_600],
  lithosphere: [74_999_000, 75_000_100],
}
