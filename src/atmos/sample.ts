import { type Season, subsolarLatForSeason, sunDirection } from './solar'
import { latLngToVec3 } from '@/src/tectonics/sphericalGeometry'

export interface InspectSample {
  lat: number
  lng: number
  tempC: number
  pressureHpa: number
  dewpointC: number
  lapseCPerKm: number
  labels: { temp: string; humidity: string; wind: string }
}

const LAPSE_RATE_C_PER_KM = 6.5
/** Fraction of subsolar latitude the temperature baseline shifts by.
 *  Matches the Heatmap shader's seasonal heat-shift fraction so the
 *  inspect readout aligns with what the user sees on the globe. */
const SEASONAL_HEAT_SHIFT_FRACTION = 0.6

/**
 * Atmospheric values at a surface point. All physics is a deliberately
 * simple v1 model:
 *   - Base temperature peaks at the (season-shifted) "hot latitude" and
 *     falls off ~0.45°C per degree of angular distance from there.
 *   - Day/night adjustment of ±5°C from the sun-direction dot product
 *     (sun direction depends on season too).
 *   - Pressure profile has the three classical zones: equatorial low,
 *     subtropical high at ±30°, subpolar low at ±60°, polar high at ±90°.
 *   - Dewpoint spread grows with distance from the hot latitude (humid
 *     tropics → dry poles).
 *
 * No globals, no IO — safe to memoize, server-render, or run in tests.
 */
export function sampleAt(
  lat: number,
  lng: number,
  hour: number,
  season: Season = 'equinox',
): InspectSample {
  const absLat = Math.abs(lat)
  // Season-shifted hot baseline. Matches the heatmap shader so the
  // numerical readout agrees with the visible gradient peak.
  const hotLat = subsolarLatForSeason(season) * SEASONAL_HEAT_SHIFT_FRACTION
  const distFromHot = Math.abs(lat - hotLat)

  // Base temperature: 30°C at the hot baseline, falls ~0.45°C per degree
  // angular distance from there. Day/night: +5°C if point is well-
  // illuminated, -5°C if well-shadowed. dot > 0.3 ≈ within 73° of subsolar.
  const point = latLngToVec3(lat, lng, 1)
  const sun = sunDirection(hour, season)
  const illumination = point.dot(sun)
  const dayNightOffset = illumination > 0.3 ? 5 : illumination < -0.3 ? -5 : 0
  const tempC = 30 - 0.45 * distFromHot + dayNightOffset

  // Pressure profile via piecewise cubic blending around the four anchors:
  //   eq 1008 | 30° 1018 | 60° 1005 | 90° 1015. Still |lat| based —
  //   pressure zones are tied to the rotating-frame Coriolis structure,
  //   not the season.
  const pressureHpa = pressureProfile(absLat)

  // Dewpoint spread: 4°C near hot baseline → 20°C at the poles, smooth
  // quadratic on distance from hot.
  const spread = 4 + (16 * distFromHot * distFromHot) / (90 * 90)
  const dewpointC = tempC - spread

  return {
    lat,
    lng,
    tempC,
    pressureHpa,
    dewpointC,
    lapseCPerKm: LAPSE_RATE_C_PER_KM,
    labels: {
      temp: tempLabel(tempC),
      humidity: humidityLabel(spread),
      wind: windLabel(absLat),
    },
  }
}

function pressureProfile(absLat: number): number {
  // Smooth interpolation through (0, 1008), (30, 1018), (60, 1005), (90, 1015)
  // using piecewise quadratic blends so the profile reads as the textbook
  // surface-pressure zones without overshoot.
  if (absLat <= 30) {
    const t = absLat / 30
    return 1008 + (1018 - 1008) * smoothstep(t)
  }
  if (absLat <= 60) {
    const t = (absLat - 30) / 30
    return 1018 + (1005 - 1018) * smoothstep(t)
  }
  const t = (absLat - 60) / 30
  return 1005 + (1015 - 1005) * smoothstep(Math.min(t, 1))
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

function tempLabel(c: number): string {
  if (c >= 25) return 'WARM'
  if (c >= 10) return 'MILD'
  if (c >= -5) return 'COOL'
  return 'COLD'
}

function humidityLabel(spread: number): string {
  if (spread < 8) return 'HUMID'
  if (spread < 15) return 'MILD'
  return 'DRY'
}

function windLabel(absLat: number): string {
  if (absLat < 30) return 'BREEZY' // trade winds
  if (absLat < 60) return 'WINDY' // westerlies (mid-lat storm tracks)
  return 'CALM' // polar high / weak polar easterlies
}
