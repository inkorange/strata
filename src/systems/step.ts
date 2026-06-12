import { BASELINE_MASSES, type Masses } from './carbonModel'

export interface CarbonInputs {
  masses: Masses
  fossilLever: number // 0..1
  landLever: number // -1..1
}

/** Baseline natural fluxes (GtC/yr) at baseline masses. */
const PHOTO_BASE = 120 // atmosphere -> biosphere
const RESP_BASE = 120 // biosphere -> atmosphere
const A2O_BASE = 90 // atmosphere -> ocean
const O2A_BASE = 90 // ocean -> atmosphere
const VOLC = 0.1 // lithosphere -> atmosphere
const WEATHER = 0.1 // atmosphere -> lithosphere

/** Sink-sensitivity coefficients on fractional atmospheric excess. Tuned so a
 *  present-day-magnitude perturbation relaxes on a multi-decade timescale, not
 *  in a few years. Tests assert behavior, not these exact values. */
const K_PHOTO = 0.2
const K_OCEAN = 0.2

/** Maximum human-driven fluxes (GtC/yr) at full lever deflection. */
const MAX_FOSSIL = 12 // lithosphere -> atmosphere
const MAX_LAND = 4 // biosphere <-> atmosphere

export interface FluxSet {
  photo: number
  resp: number
  a2o: number
  o2a: number
  volc: number
  weather: number
  fossil: number
  /** Signed: >0 deforestation (biosphere->atmosphere), <0 reforestation (atmosphere->biosphere). */
  land: number
}

/** All fluxes (GtC/yr) for the current masses + levers. */
export function computeFluxes(inputs: CarbonInputs): FluxSet {
  const { masses, fossilLever, landLever } = inputs
  const excessAtm = masses.atmosphere / BASELINE_MASSES.atmosphere - 1

  return {
    photo: PHOTO_BASE * (1 + K_PHOTO * excessAtm),
    resp: RESP_BASE * (masses.biosphere / BASELINE_MASSES.biosphere),
    a2o: A2O_BASE * (1 + K_OCEAN * excessAtm),
    o2a: O2A_BASE,
    volc: VOLC,
    weather: WEATHER,
    fossil: fossilLever * MAX_FOSSIL,
    land: landLever * MAX_LAND,
  }
}

/** Forward-Euler integrate one tick of `dtYears`. Returns NEW masses; levers
 *  are caller-owned and unchanged. The max(0, …) floor is a safety rail; within
 *  the bounded lever/dt envelope it never triggers, so total carbon is conserved
 *  exactly (every flux is internal to the four reservoirs). */
export function step(inputs: CarbonInputs, dtYears: number): Masses {
  const f = computeFluxes(inputs)
  const m = inputs.masses

  const defor = Math.max(0, f.land) // biosphere -> atmosphere
  const refor = Math.max(0, -f.land) // atmosphere -> biosphere

  const dAtm = f.resp + f.o2a + f.volc + f.fossil + defor - f.photo - f.a2o - f.weather - refor
  const dOcean = f.a2o - f.o2a
  const dBio = f.photo + refor - f.resp - defor
  const dLith = f.weather - f.volc - f.fossil

  return {
    atmosphere: Math.max(0, m.atmosphere + dAtm * dtYears),
    ocean: Math.max(0, m.ocean + dOcean * dtYears),
    biosphere: Math.max(0, m.biosphere + dBio * dtYears),
    lithosphere: Math.max(0, m.lithosphere + dLith * dtYears),
  }
}
