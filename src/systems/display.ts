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

/** Planetary "degradation" 0..1 derived from atmospheric carbon: a hotter,
 *  drier, deader Earth as CO2 climbs. Pre-industrial (~590 GtC) reads as a
 *  healthy 0; it ramps in past present-day and saturates around runaway
 *  emissions. Drives the land browning + atmosphere haze so the visual tells
 *  the climate story. Smoothstep for an eased ramp. */
export function degradation(atmosphereGtC: number, baselineGtC: number): number {
  // Degradation is the atmosphere's RISE above where the current scenario
  // started — not its absolute value. So day 0 of any scenario reads as
  // pristine (0) and the planet only browns as carbon accumulates over the
  // years. ~110 GtC of rise (about what a high-emissions run adds across two
  // centuries) saturates it. A flat or falling atmosphere stays healthy.
  const RISE_FULL = 110
  const t = Math.max(0, Math.min(1, (atmosphereGtC - baselineGtC) / RISE_FULL))
  return t * t * (3 - 2 * t)
}
