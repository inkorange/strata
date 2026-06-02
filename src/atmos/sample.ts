import { sunDirection } from './solar'
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

/**
 * Atmospheric values at a surface point. All physics is a deliberately
 * simple v1 model:
 *   - Base temperature falls linearly with |lat| from 30°C at the equator.
 *   - Day/night adjustment of ±5°C from the sun-direction dot product.
 *   - Pressure profile has the three classical zones: equatorial low,
 *     subtropical high at ±30°, subpolar low at ±60°, polar high at ±90°.
 *   - Dewpoint spread grows with |lat| (humid tropics → dry poles).
 *
 * No globals, no IO — safe to memoize, server-render, or run in tests.
 */
export function sampleAt(lat: number, lng: number, hour: number): InspectSample {
  const absLat = Math.abs(lat)

  // Base temperature: 30°C at eq, falls ~0.45°C per degree latitude
  // (~ -10°C at 90°). Day/night: +5°C if point is well-illuminated, -5°C
  // if well-shadowed. dot > 0.3 ≈ within 73° of the subsolar point.
  const point = latLngToVec3(lat, lng, 1)
  const sun = sunDirection(hour)
  const illumination = point.dot(sun)
  const dayNightOffset = illumination > 0.3 ? 5 : illumination < -0.3 ? -5 : 0
  const tempC = 30 - 0.45 * absLat + dayNightOffset

  // Pressure profile via piecewise cubic blending around the four anchors:
  //   eq 1008 | 30° 1018 | 60° 1005 | 90° 1015
  const pressureHpa = pressureProfile(absLat)

  // Dewpoint spread: 4°C tropics → 20°C poles, smooth quadratic.
  const spread = 4 + (16 * absLat * absLat) / (90 * 90)
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
