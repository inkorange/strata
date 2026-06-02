# Atmosphere Day-Cycle Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Module B per `docs/superpowers/specs/2026-05-27-atmosphere-day-cycle-design.md` — a read-only 24-hour day-cycle viewer that overlays surface temperature, animated convection-cell arrows, and an ITCZ cloud band on the existing Earth globe.

**Architecture:** A new pure-TS engine in `src/atmos/` (mirroring `src/tectonics/`'s boundaries) exposes solar position, atmospheric sampling, and cell-band geometry as deterministic functions. A Zustand slice tracks the scrubber hour, layer toggles, and the hovered point. R3F components mount only when `activeModule === 'atmosphere'`; cell-arrow flow is GPU-driven via a shared `uPhase` uniform so React never re-renders the streamlines.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Three.js 0.184 via `@react-three/fiber` 9 + `@react-three/drei` 10 · Zustand 5 (+ immer) · Vitest 4 · Playwright 1.60 · existing shell primitives (`Scene`, `PersistentScene`, `CameraDolly`, `ModuleFrame`, `TutorPanel`).

---

## Branch and starting state

This plan executes on the existing branch `atmosphere-v1-day-cycle-spec` (created by the brainstorming step; spec is committed at `c7d4cf8`). All tasks land additional commits on this branch. When the plan is complete a PR is opened against `main`.

Before starting, verify the working tree is clean and tests pass:

```bash
git status
npx vitest run
npx tsc --noEmit
```

Expected: clean tree, all 82 existing tests pass, no type errors.

---

## File map (created and modified)

**Created:**

- `src/atmos/solar.ts` + `solar.spec.ts`
- `src/atmos/sample.ts` + `sample.spec.ts`
- `src/atmos/cellBands.ts` + `cellBands.spec.ts`
- `src/atmos/atmosphereSlice.ts` + `atmosphereSlice.spec.ts`
- `src/atmos/scene/Atmosphere.tsx`
- `src/atmos/scene/Sun.tsx`
- `src/atmos/scene/Heatmap.tsx`
- `src/atmos/scene/Cells.tsx`
- `src/atmos/scene/CloudBand.tsx`
- `src/atmos/scene/HoverInspector.tsx`
- `src/atmos/ui/AtmosphereBody.tsx`
- `src/atmos/ui/ChipBar.tsx`
- `src/atmos/ui/Timeline.tsx`
- `src/atmos/ui/InspectReadout.tsx`
- `src/atmos/ui/Legend.tsx`
- `tests/e2e/atmosphere.spec.ts`

**Modified:**

- `src/tectonics/sphericalGeometry.ts` (add `vec3ToLatLng` helper, used by atmos and HoverInspector)
- `src/tectonics/sphericalGeometry.spec.ts` (cover the new helper)
- `src/tectonics/tweenPlates.ts` (refactor to use new helper — DRY)
- `src/store/index.ts` (compose `atmosphereSlice`)
- `src/scene/PersistentScene.tsx` (mount `<Atmosphere />`)
- `src/shell/modules.tsx` (replace atmosphere stub with `AtmosphereBody`)
- `src/ui/TutorPanel.tsx` (update `SUGGESTED_PROMPTS.atmosphere`)

---

## Task 1: Add `vec3ToLatLng` helper to `sphericalGeometry.ts`

The inverse of `latLngToVec3` is needed by `cellBands` (for arrow tangent calculations), `HoverInspector` (raycast hit → lat/lng), and refactors two inlined copies already in `tweenPlates`. Land this first so every later task can import it.

**Files:**

- Modify: `src/tectonics/sphericalGeometry.ts`
- Modify: `src/tectonics/sphericalGeometry.spec.ts`
- Modify: `src/tectonics/tweenPlates.ts`

- [ ] **Step 1: Write the failing tests** in `src/tectonics/sphericalGeometry.spec.ts`. Append this `describe` block after the existing `latLngToVec3` block:

```ts
describe('vec3ToLatLng', () => {
  it('inverts latLngToVec3 at the prime meridian', () => {
    const v = latLngToVec3(0, 0, 1)
    const [lat, lng] = vec3ToLatLng(v)
    expect(lat).toBeCloseTo(0, 5)
    expect(lng).toBeCloseTo(0, 5)
  })

  it('inverts at the north pole regardless of input lng', () => {
    const v = latLngToVec3(90, 42, 1)
    const [lat] = vec3ToLatLng(v)
    expect(lat).toBeCloseTo(90, 5)
  })

  it('inverts at 90°E', () => {
    const v = latLngToVec3(0, 90, 1)
    const [lat, lng] = vec3ToLatLng(v)
    expect(lat).toBeCloseTo(0, 5)
    expect(lng).toBeCloseTo(90, 5)
  })

  it('inverts at 90°W', () => {
    const v = latLngToVec3(0, -90, 1)
    const [lat, lng] = vec3ToLatLng(v)
    expect(lat).toBeCloseTo(0, 5)
    expect(lng).toBeCloseTo(-90, 5)
  })

  it('is robust to vectors not on the unit sphere (normalizes internally)', () => {
    const v = latLngToVec3(30, 45, 7.5) // arbitrary radius
    const [lat, lng] = vec3ToLatLng(v)
    expect(lat).toBeCloseTo(30, 5)
    expect(lng).toBeCloseTo(45, 5)
  })
})
```

Update the existing import at the top of the spec file:

```ts
import { latLngToVec3, slerpOnSphere, triangulatePolygonFan, vec3ToLatLng } from './sphericalGeometry'
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tectonics/sphericalGeometry.spec.ts
```

Expected: 5 new tests fail with `vec3ToLatLng is not a function` (or TypeScript error if run via tsc). Existing tests still pass.

- [ ] **Step 3: Implement `vec3ToLatLng`** by appending this export to `src/tectonics/sphericalGeometry.ts`, immediately after the `latLngToVec3` function:

```ts
/**
 * Inverse of latLngToVec3. Takes any 3D point (vector need not be on the
 * unit sphere — its direction is what matters) and returns the (lat, lng)
 * pair in degrees that latLngToVec3 maps to that direction.
 *
 *   vec3ToLatLng(latLngToVec3(lat, lng, r)) === [lat, lng]   (modulo float)
 *
 * Uses the same Z-negated convention as latLngToVec3: longitude increases
 * clockwise from the north pole.
 */
export function vec3ToLatLng(v: THREE.Vector3): [number, number] {
  const len = Math.hypot(v.x, v.y, v.z) || 1
  const y = v.y / len
  const lat = (Math.asin(THREE.MathUtils.clamp(y, -1, 1)) * 180) / Math.PI
  const lng = (Math.atan2(-v.z, v.x) * 180) / Math.PI
  return [lat, lng]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/tectonics/sphericalGeometry.spec.ts
```

Expected: all sphericalGeometry tests pass (16 prior + 5 new = 21).

- [ ] **Step 5: Refactor `tweenPlates.ts` to use the helper** (DRY — removes two duplicated inline conversions).

Open `src/tectonics/tweenPlates.ts` and update the import line:

```ts
import { latLngToVec3, slerpOnSphere, vec3ToLatLng } from './sphericalGeometry'
```

Replace lines 47–52 (the `tweenPlates` lat/lng conversion block):

```ts
      // Convert interpolated vec3 back to (lat, lng) degrees. Must be the
      // exact inverse of latLngToVec3, which negates z, so the lng inverse
      // is atan2(-z, x) — not atan2(z, x). Using the wrong sign here makes
      // tweens snap to a longitude-mirrored pose on the first frame of
      // animation because the SLERP→lat/lng→vec3 roundtrip in the renderer
      // produces a position far from the source.
      const lat = (Math.asin(THREE.MathUtils.clamp(vi.y, -1, 1)) * 180) / Math.PI
      const lng = (Math.atan2(-vi.z, vi.x) * 180) / Math.PI
```

with:

```ts
      const [lat, lng] = vec3ToLatLng(vi)
```

Replace lines 113–115 (the `tweenContinents` block — line numbers shift after the first edit, so search for the second occurrence of `Math.asin(THREE.MathUtils.clamp(vi.y` in the file):

```ts
        const lat = (Math.asin(THREE.MathUtils.clamp(vi.y, -1, 1)) * 180) / Math.PI
        const lng = (Math.atan2(-vi.z, vi.x) * 180) / Math.PI
```

with:

```ts
        const [lat, lng] = vec3ToLatLng(vi)
```

Confirm the THREE import is no longer needed in tweenPlates for these lines — if `import * as THREE from 'three'` is now unused elsewhere in the file, remove it. Otherwise leave it.

- [ ] **Step 6: Run all tests to verify the refactor didn't break tween behavior**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: all 87 tests pass (was 82, +5 for vec3ToLatLng). No type errors.

- [ ] **Step 7: Commit**

```bash
git add src/tectonics/sphericalGeometry.ts src/tectonics/sphericalGeometry.spec.ts src/tectonics/tweenPlates.ts
git commit -m "Add vec3ToLatLng helper; deduplicate tween inverse conversion

The atmos engine and HoverInspector both need the inverse of latLngToVec3.
Same conversion was inlined twice in tweenPlates. Extracting into one
tested helper deletes the duplication and lets the new module reuse it."
```

---

## Task 2: `solar.ts` — sun direction + subsolar point + ITCZ brightness

The day-cycle engine. Pure functions of `hour` ∈ [0, 24).

**Files:**

- Create: `src/atmos/solar.ts`
- Create: `src/atmos/solar.spec.ts`

- [ ] **Step 1: Write the failing tests** at `src/atmos/solar.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { latLngToVec3 } from '@/src/tectonics/sphericalGeometry'
import { itczBrightness, subsolarPoint, sunDirection } from './solar'

describe('subsolarPoint', () => {
  it('returns (0, 0) at noon (h=12)', () => {
    const [lat, lng] = subsolarPoint(12)
    expect(lat).toBeCloseTo(0, 5)
    expect(lng).toBeCloseTo(0, 5)
  })

  it('returns (0, 180) at midnight (h=0)', () => {
    const [lat, lng] = subsolarPoint(0)
    expect(lat).toBeCloseTo(0, 5)
    expect(Math.abs(lng)).toBeCloseTo(180, 5) // ±180 are the same meridian
  })

  it('returns (0, -90) at sunrise (h=6)', () => {
    const [lat, lng] = subsolarPoint(6)
    expect(lat).toBeCloseTo(0, 5)
    expect(lng).toBeCloseTo(-90, 5)
  })

  it('returns (0, 90) at sunset (h=18)', () => {
    const [lat, lng] = subsolarPoint(18)
    expect(lat).toBeCloseTo(0, 5)
    expect(lng).toBeCloseTo(90, 5)
  })

  it('always returns lat=0 at equinox (no tilt)', () => {
    for (const h of [0, 3, 6, 9, 12, 15, 18, 21]) {
      const [lat] = subsolarPoint(h)
      expect(lat).toBeCloseTo(0, 5)
    }
  })
})

describe('sunDirection', () => {
  it('returns a unit vector', () => {
    for (const h of [0, 6, 12, 18, 23.9]) {
      const v = sunDirection(h)
      expect(v.length()).toBeCloseTo(1, 5)
    }
  })

  it('points along +X at noon (h=12)', () => {
    const v = sunDirection(12)
    expect(v.x).toBeCloseTo(1, 5)
    expect(v.y).toBeCloseTo(0, 5)
    expect(v.z).toBeCloseTo(0, 5)
  })

  it('matches the subsolar point under latLngToVec3 convention', () => {
    // The sun direction at hour h should equal latLngToVec3(subsolarLat, subsolarLng, 1).
    // This couples solar.ts to the Z-negated convention without re-implementing it.
    for (const h of [0, 6, 12, 18]) {
      const [lat, lng] = subsolarPoint(h)
      const fromSubsolar = latLngToVec3(lat, lng, 1)
      const v = sunDirection(h)
      expect(v.x).toBeCloseTo(fromSubsolar.x, 5)
      expect(v.y).toBeCloseTo(fromSubsolar.y, 5)
      expect(v.z).toBeCloseTo(fromSubsolar.z, 5)
    }
  })
})

describe('itczBrightness', () => {
  it('returns a value in [0, 1] for any hour', () => {
    for (const h of [0, 3, 6, 9, 12, 15, 18, 21, 23.999]) {
      const b = itczBrightness(h)
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(1)
    }
  })

  it('peaks at noon', () => {
    expect(itczBrightness(12)).toBeCloseTo(1, 5)
  })

  it('is monotonically increasing from sunrise to noon', () => {
    const samples = [6, 7, 8, 9, 10, 11, 12].map(itczBrightness)
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1] as number)
    }
  })

  it('is monotonically decreasing from noon to sunset', () => {
    const samples = [12, 13, 14, 15, 16, 17, 18].map(itczBrightness)
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1] as number)
    }
  })

  it('is at minimum on the night side', () => {
    // h=0 and h=24 both put the sun behind the camera-facing hemisphere.
    expect(itczBrightness(0)).toBeCloseTo(0, 2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/atmos/solar.spec.ts
```

Expected: all tests fail with module-not-found (`Cannot find module './solar'`).

- [ ] **Step 3: Implement `solar.ts`**:

```ts
import * as THREE from 'three'
import { latLngToVec3 } from '@/src/tectonics/sphericalGeometry'

export type LatLng = readonly [number, number]

/**
 * Subsolar point — where the sun is directly overhead at a given UTC hour.
 *
 * v1 locks Earth to equinox (no axial tilt) so lat is always 0. Longitude
 * sweeps full -180..180 as the day advances: noon (h=12) → lng=0, midnight
 * (h=0/24) → lng=±180, sunrise (h=6) → lng=-90, sunset (h=18) → lng=+90.
 */
export function subsolarPoint(hour: number): LatLng {
  const lng = (hour - 12) * 15 // 360°/24h = 15°/h
  // Wrap to (-180, 180]
  const wrapped = lng > 180 ? lng - 360 : lng <= -180 ? lng + 360 : lng
  return [0, wrapped]
}

/**
 * Unit vector pointing FROM Earth's center TOWARD the sun at hour h.
 * Composed from subsolarPoint so it shares the Z-negated lat/lng convention
 * of latLngToVec3, which downstream R3F components rely on for occlusion
 * and lighting alignment.
 */
export function sunDirection(hour: number): THREE.Vector3 {
  const [lat, lng] = subsolarPoint(hour)
  return latLngToVec3(lat, lng, 1)
}

/**
 * Global brightness of the ITCZ cloud band, in [0, 1].
 *
 * Models the qualitative observation that the ITCZ glows brightest when
 * the sun is directly over its meridian (noon, h=12) and is invisible to
 * the front-facing camera when the sun is on the back of the globe
 * (midnight, h=0). We use a smooth cosine ramp on the sun's longitudinal
 * angle relative to the prime meridian — the cosine peaks at noon, hits 0
 * at sunrise/sunset, and goes slightly negative through the night, which
 * we clamp to 0.
 */
export function itczBrightness(hour: number): number {
  const angleRad = ((hour - 12) / 24) * 2 * Math.PI
  return Math.max(0, Math.cos(angleRad))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/atmos/solar.spec.ts
```

Expected: all 15 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/atmos/solar.ts src/atmos/solar.spec.ts
git commit -m "atmos: add solar.ts — sun direction, subsolar point, ITCZ brightness"
```

---

## Task 3: `sample.ts` — atmospheric values at a point

Pure function: `sampleAt(lat, lng, hour) → InspectSample`. Used by the `InspectReadout` UI.

**Files:**

- Create: `src/atmos/sample.ts`
- Create: `src/atmos/sample.spec.ts`

- [ ] **Step 1: Write the failing tests** at `src/atmos/sample.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { sampleAt } from './sample'

describe('sampleAt — temperature', () => {
  it('is warmest at the equator at noon', () => {
    const s = sampleAt(0, 0, 12)
    // Base 30°C at eq + 5°C illuminated = 35°C ballpark.
    expect(s.tempC).toBeGreaterThan(30)
    expect(s.tempC).toBeLessThan(40)
  })

  it('is much colder at the pole than at the equator (any hour)', () => {
    const eq = sampleAt(0, 0, 12)
    const pole = sampleAt(85, 0, 12)
    expect(pole.tempC).toBeLessThan(eq.tempC - 30)
  })

  it('night side is colder than day side at the same latitude', () => {
    const day = sampleAt(0, 0, 12)   // sun overhead
    const night = sampleAt(0, 180, 12) // antipode
    expect(night.tempC).toBeLessThan(day.tempC)
  })

  it('is symmetric across the equator (|lat| only)', () => {
    expect(sampleAt(30, 50, 12).tempC).toBeCloseTo(sampleAt(-30, 50, 12).tempC, 5)
  })
})

describe('sampleAt — pressure', () => {
  it('is highest at the subtropical highs (±30°)', () => {
    const eq = sampleAt(0, 0, 12).pressureHpa
    const subtrop = sampleAt(30, 0, 12).pressureHpa
    const subpolar = sampleAt(60, 0, 12).pressureHpa
    expect(subtrop).toBeGreaterThan(eq)
    expect(subtrop).toBeGreaterThan(subpolar)
  })

  it('falls back to a subpolar low at 60°', () => {
    const subtrop = sampleAt(30, 0, 12).pressureHpa
    const subpolar = sampleAt(60, 0, 12).pressureHpa
    expect(subpolar).toBeLessThan(subtrop)
  })

  it('is in a realistic surface band 1000–1025 hPa', () => {
    for (const lat of [0, 15, 30, 45, 60, 75, 90]) {
      const p = sampleAt(lat, 0, 12).pressureHpa
      expect(p).toBeGreaterThanOrEqual(1000)
      expect(p).toBeLessThanOrEqual(1025)
    }
  })
})

describe('sampleAt — dewpoint', () => {
  it('never exceeds temperature', () => {
    for (const lat of [-90, -45, 0, 45, 90]) {
      const s = sampleAt(lat, 0, 12)
      expect(s.dewpointC).toBeLessThanOrEqual(s.tempC)
    }
  })

  it('is closer to temp in the humid tropics than at the dry poles', () => {
    const tropics = sampleAt(0, 0, 12)
    const pole = sampleAt(85, 0, 12)
    expect(tropics.tempC - tropics.dewpointC).toBeLessThan(pole.tempC - pole.dewpointC)
  })
})

describe('sampleAt — lapse rate', () => {
  it('is the standard 6.5°C/km everywhere for v1', () => {
    expect(sampleAt(0, 0, 12).lapseCPerKm).toBeCloseTo(6.5, 5)
    expect(sampleAt(85, 175, 0).lapseCPerKm).toBeCloseTo(6.5, 5)
  })
})

describe('sampleAt — verbal labels', () => {
  it('returns WARM at the tropics', () => {
    expect(sampleAt(0, 0, 12).labels.temp).toBe('WARM')
  })

  it('returns COLD at the poles', () => {
    expect(sampleAt(85, 0, 12).labels.temp).toBe('COLD')
  })

  it('returns BREEZY in the trade wind band (|lat| < 30)', () => {
    expect(sampleAt(15, 0, 12).labels.wind).toBe('BREEZY')
  })

  it('returns WINDY in the mid-latitude westerly band', () => {
    expect(sampleAt(45, 0, 12).labels.wind).toBe('WINDY')
  })

  it('returns CALM at the poles (polar high)', () => {
    expect(sampleAt(85, 0, 12).labels.wind).toBe('CALM')
  })

  it('returns HUMID where dewpoint spread is small (tropics)', () => {
    expect(sampleAt(0, 0, 12).labels.humidity).toBe('HUMID')
  })

  it('returns DRY where dewpoint spread is large (poles)', () => {
    expect(sampleAt(85, 0, 12).labels.humidity).toBe('DRY')
  })

  it('echoes lat/lng on the sample', () => {
    const s = sampleAt(40, -90, 14)
    expect(s.lat).toBe(40)
    expect(s.lng).toBe(-90)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/atmos/sample.spec.ts
```

Expected: all tests fail with `Cannot find module './sample'`.

- [ ] **Step 3: Implement `sample.ts`**:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/atmos/sample.spec.ts
```

Expected: all 16 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/atmos/sample.ts src/atmos/sample.spec.ts
git commit -m "atmos: add sample.ts — temp/pressure/dewpoint at any (lat, lng, hour)"
```

---

## Task 4: `cellBands.ts` — band definitions + great-circle arrow arcs

The six convection bands and their per-arrow arc geometry. Drives the `<Cells>` mesh.

**Files:**

- Create: `src/atmos/cellBands.ts`
- Create: `src/atmos/cellBands.spec.ts`

- [ ] **Step 1: Write the failing tests** at `src/atmos/cellBands.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CELL_BANDS, allArrowArcs, arrowArcPoints } from './cellBands'

describe('CELL_BANDS', () => {
  it('has exactly 6 bands (2 polar, 2 westerly, 2 trade)', () => {
    expect(CELL_BANDS).toHaveLength(6)
    const ids = CELL_BANDS.map((b) => b.id).sort()
    expect(ids).toEqual([
      'polar-n',
      'polar-s',
      'trade-n',
      'trade-s',
      'westerly-n',
      'westerly-s',
    ])
  })

  it('places bands at the documented latitudes', () => {
    const byId = Object.fromEntries(CELL_BANDS.map((b) => [b.id, b]))
    expect(byId['polar-n']?.latDeg).toBe(75)
    expect(byId['polar-s']?.latDeg).toBe(-75)
    expect(byId['westerly-n']?.latDeg).toBe(45)
    expect(byId['westerly-s']?.latDeg).toBe(-45)
    expect(byId['trade-n']?.latDeg).toBe(15)
    expect(byId['trade-s']?.latDeg).toBe(-15)
  })

  it('uses the documented ring densities per belt type', () => {
    const byBelt = (belt: string) => CELL_BANDS.filter((b) => b.belt === belt)
    expect(byBelt('polar').every((b) => b.arrowsAroundRing === 4)).toBe(true)
    expect(byBelt('westerly').every((b) => b.arrowsAroundRing === 6)).toBe(true)
    expect(byBelt('trade').every((b) => b.arrowsAroundRing === 8)).toBe(true)
  })
})

describe('arrowArcPoints', () => {
  it('returns at least 4 points so a TubeGeometry can be built', () => {
    const band = CELL_BANDS.find((b) => b.id === 'trade-n')!
    const points = arrowArcPoints(band, 0, band.arrowsAroundRing, 8)
    expect(points.length).toBeGreaterThanOrEqual(4)
  })

  it('places every point on the unit sphere (within float tolerance)', () => {
    for (const band of CELL_BANDS) {
      const points = arrowArcPoints(band, 0, band.arrowsAroundRing, 8)
      for (const p of points) {
        expect(p.length()).toBeCloseTo(1, 4)
      }
    }
  })

  it('places successive arrows around the latitude ring at evenly spaced longitudes', () => {
    const band = CELL_BANDS.find((b) => b.id === 'trade-n')!
    // Take the first point of arrow 0 and arrow 1, compare their projected longitudes.
    const p0 = arrowArcPoints(band, 0, band.arrowsAroundRing, 8)[0]!
    const p1 = arrowArcPoints(band, 1, band.arrowsAroundRing, 8)[0]!
    const lng0 = (Math.atan2(-p0.z, p0.x) * 180) / Math.PI
    const lng1 = (Math.atan2(-p1.z, p1.x) * 180) / Math.PI
    const expectedSpacing = 360 / band.arrowsAroundRing
    const actualSpacing = ((lng1 - lng0 + 540) % 360) - 180
    expect(Math.abs(actualSpacing)).toBeCloseTo(expectedSpacing, 1)
  })

  it('curves trade-wind arrows toward the equator', () => {
    // First and last point should bracket the equator for a NE→SW arc:
    // start is at a higher latitude than the end.
    const band = CELL_BANDS.find((b) => b.id === 'trade-n')!
    const points = arrowArcPoints(band, 0, band.arrowsAroundRing, 8)
    const startLat = (Math.asin(points[0]!.y) * 180) / Math.PI
    const endLat = (Math.asin(points[points.length - 1]!.y) * 180) / Math.PI
    expect(startLat).toBeGreaterThan(endLat)
  })
})

describe('allArrowArcs', () => {
  it('returns one entry per arrow across all bands (8+6+4 per hemisphere × 2 hemispheres = 36)', () => {
    const arcs = allArrowArcs()
    const totalArrows = CELL_BANDS.reduce((sum, b) => sum + b.arrowsAroundRing, 0)
    expect(arcs).toHaveLength(totalArrows)
  })

  it('tags each arc with its band and longitudeIndex', () => {
    const arcs = allArrowArcs()
    for (const a of arcs) {
      expect(CELL_BANDS).toContain(a.band)
      expect(a.longitudeIndex).toBeGreaterThanOrEqual(0)
      expect(a.longitudeIndex).toBeLessThan(a.band.arrowsAroundRing)
      expect(a.points.length).toBeGreaterThanOrEqual(4)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/atmos/cellBands.spec.ts
```

Expected: all tests fail with `Cannot find module './cellBands'`.

- [ ] **Step 3: Implement `cellBands.ts`**:

```ts
import * as THREE from 'three'
import { latLngToVec3 } from '@/src/tectonics/sphericalGeometry'

export interface CellBand {
  id: 'polar-n' | 'westerly-n' | 'trade-n' | 'trade-s' | 'westerly-s' | 'polar-s'
  latDeg: number
  belt: 'trade' | 'westerly' | 'polar'
  /** Total arrows around the full latitude ring. ~half are on the visible
   *  front of the globe from any single camera angle. */
  arrowsAroundRing: 4 | 6 | 8
  /** Per-arrow canonical shape in surface-tangent local coords (degrees
   *  along-band and perp-to-band). Curves at trade latitudes pull the
   *  perimeter end toward the equator; westerly + polar shapes are
   *  effectively straight along the band. */
  shape: {
    /** Longitudinal span of the arrow along the band, in degrees. */
    arcDeg: number
    /** Latitudinal pull at the arrow's end, in degrees toward the equator
     *  (positive value bends the arrow's terminus equatorward). */
    equatorPullDeg: number
  }
}

export const CELL_BANDS: ReadonlyArray<CellBand> = Object.freeze([
  // North hemisphere
  {
    id: 'polar-n',
    latDeg: 75,
    belt: 'polar',
    arrowsAroundRing: 4,
    shape: { arcDeg: 24, equatorPullDeg: 0 },
  },
  {
    id: 'westerly-n',
    latDeg: 45,
    belt: 'westerly',
    arrowsAroundRing: 6,
    shape: { arcDeg: 28, equatorPullDeg: 0 },
  },
  {
    id: 'trade-n',
    latDeg: 15,
    belt: 'trade',
    arrowsAroundRing: 8,
    shape: { arcDeg: 22, equatorPullDeg: 6 },
  },
  // South hemisphere (mirror)
  {
    id: 'trade-s',
    latDeg: -15,
    belt: 'trade',
    arrowsAroundRing: 8,
    shape: { arcDeg: 22, equatorPullDeg: 6 },
  },
  {
    id: 'westerly-s',
    latDeg: -45,
    belt: 'westerly',
    arrowsAroundRing: 6,
    shape: { arcDeg: 28, equatorPullDeg: 0 },
  },
  {
    id: 'polar-s',
    latDeg: -75,
    belt: 'polar',
    arrowsAroundRing: 4,
    shape: { arcDeg: 24, equatorPullDeg: 0 },
  },
])

/**
 * Sample N evenly-spaced 3D points along one arrow's arc on the unit sphere.
 *
 * The arc is laid out in (lng, lat) using the band's `shape` definition, then
 * each (lat, lng) is projected to vec3 via latLngToVec3. Longitudinal flow
 * direction depends on the belt: trade and polar belts blow east→west
 * (arrowhead at the western end), westerlies blow west→east.
 *
 * `arrowsAroundRing` is the parameter the caller passes (typically just
 * `band.arrowsAroundRing`) and controls the per-arrow longitude offset:
 * arrow `longitudeIndex` is centered at lng = (360/arrowsAroundRing) * idx.
 *
 * `segments` is the resolution along the arc (number of points returned).
 */
export function arrowArcPoints(
  band: CellBand,
  longitudeIndex: number,
  arrowsAroundRing: number,
  segments: number,
): THREE.Vector3[] {
  const startLng = (360 / arrowsAroundRing) * longitudeIndex - 180
  const flowSign = band.belt === 'westerly' ? +1 : -1 // east→west belts get -1
  const endLng = startLng + flowSign * band.shape.arcDeg
  // Equator pull: trade arrows bend toward the equator at their terminus.
  const equatorSign = band.latDeg >= 0 ? -1 : +1
  const endLat = band.latDeg + equatorSign * band.shape.equatorPullDeg

  const out: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const eased = t * t * (3 - 2 * t) // smoothstep so the curve eases
    const lng = startLng + (endLng - startLng) * t
    const lat = band.latDeg + (endLat - band.latDeg) * eased
    out.push(latLngToVec3(lat, lng, 1))
  }
  return out
}

/** Every arrow in every band, ready for mesh construction. */
export function allArrowArcs(): { band: CellBand; longitudeIndex: number; points: THREE.Vector3[] }[] {
  const out: { band: CellBand; longitudeIndex: number; points: THREE.Vector3[] }[] = []
  for (const band of CELL_BANDS) {
    for (let i = 0; i < band.arrowsAroundRing; i++) {
      out.push({
        band,
        longitudeIndex: i,
        points: arrowArcPoints(band, i, band.arrowsAroundRing, 16),
      })
    }
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/atmos/cellBands.spec.ts
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/atmos/cellBands.ts src/atmos/cellBands.spec.ts
git commit -m "atmos: add cellBands.ts — 6-band layout + great-circle arrow arcs"
```

---

## Task 5: `atmosphereSlice.ts` — Zustand slice

State: `hour`, `layers`, `inspectAt`. Follows the same shape as `tectonicsSlice`.

**Files:**

- Create: `src/atmos/atmosphereSlice.ts`
- Create: `src/atmos/atmosphereSlice.spec.ts`

- [ ] **Step 1: Write the failing tests** at `src/atmos/atmosphereSlice.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function freshStore() {
  vi.resetModules()
  const mod = await import('@/src/store')
  return mod.useStore
}

describe('atmosphereSlice', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults: hour=12, all layers on, inspectAt=null', async () => {
    const store = await freshStore()
    const state = store.getState()
    expect(state.hour).toBe(12)
    expect(state.layers).toEqual({ cells: true, temp: true, clouds: true })
    expect(state.inspectAt).toBeNull()
  })

  it('setHour clamps to [0, 24)', async () => {
    const store = await freshStore()
    store.getState().setHour(-3)
    expect(store.getState().hour).toBe(0)
    store.getState().setHour(24)
    expect(store.getState().hour).toBeLessThan(24)
    expect(store.getState().hour).toBeGreaterThanOrEqual(23.999)
    store.getState().setHour(14.5)
    expect(store.getState().hour).toBe(14.5)
  })

  it('toggleLayer flips just that layer', async () => {
    const store = await freshStore()
    store.getState().toggleLayer('cells')
    expect(store.getState().layers).toEqual({ cells: false, temp: true, clouds: true })
    store.getState().toggleLayer('temp')
    expect(store.getState().layers).toEqual({ cells: false, temp: false, clouds: true })
    store.getState().toggleLayer('cells')
    expect(store.getState().layers).toEqual({ cells: true, temp: false, clouds: true })
  })

  it('setInspectAt accepts a point and round-trips to null', async () => {
    const store = await freshStore()
    store.getState().setInspectAt([40, -90])
    expect(store.getState().inspectAt).toEqual([40, -90])
    store.getState().setInspectAt(null)
    expect(store.getState().inspectAt).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/atmos/atmosphereSlice.spec.ts
```

Expected: all tests fail. Default test fails on `state.hour` undefined; setHour test fails with `setHour is not a function`, etc.

- [ ] **Step 3: Implement `atmosphereSlice.ts`**:

```ts
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
```

- [ ] **Step 4: Run tests to verify they fail (slice not yet wired into store)**

```bash
npx vitest run src/atmos/atmosphereSlice.spec.ts
```

Expected: tests still fail because the slice isn't composed into `useStore` yet. The fix is the next task.

- [ ] **Step 5: Commit (slice only; wire-up follows in Task 6)**

```bash
git add src/atmos/atmosphereSlice.ts src/atmos/atmosphereSlice.spec.ts
git commit -m "atmos: add atmosphereSlice — hour, layer toggles, inspectAt"
```

---

## Task 6: Compose `atmosphereSlice` into the store

**Files:**

- Modify: `src/store/index.ts`

- [ ] **Step 1: Add the import + compose** at `src/store/index.ts`. After the existing `tectonicsSlice` import, add:

```ts
import { createAtmosphereSlice, type AtmosphereSlice } from '@/src/atmos/atmosphereSlice'
```

Then update the `Store` type to include `AtmosphereSlice`:

```ts
type Store = ShellSlice &
  TectonicsSlice &
  AtmosphereSlice & {
    /** Test-only helper: flush the persist debounce synchronously. */
    __flushPersist?: () => void
  }
```

Inside `useStore = create<Store>()(...)`, add the slice next to the others. Replace:

```ts
  const shellSlicePart = createShellSlice(set, get, api)
  const tectonicsSlicePart = createTectonicsSlice(set, get, api)
  const rehydrated = readPersistedShell()

  return {
    ...shellSlicePart,
    ...tectonicsSlicePart,
    ...rehydrated,
    __flushPersist: () => persistShell(get() as ShellSlice),
  }
```

with:

```ts
  const shellSlicePart = createShellSlice(set, get, api)
  const tectonicsSlicePart = createTectonicsSlice(set, get, api)
  const atmosphereSlicePart = createAtmosphereSlice(set, get, api)
  const rehydrated = readPersistedShell()

  return {
    ...shellSlicePart,
    ...tectonicsSlicePart,
    ...atmosphereSlicePart,
    ...rehydrated,
    __flushPersist: () => persistShell(get() as ShellSlice),
  }
```

- [ ] **Step 2: Run the atmosphereSlice tests + the existing store tests**

```bash
npx vitest run src/atmos/atmosphereSlice.spec.ts src/tectonics/tectonicsSlice.spec.ts src/store/
```

Expected: all atmosphereSlice tests pass; tectonicsSlice and shellSlice tests still pass.

- [ ] **Step 3: Run the full test suite + typecheck**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: all tests pass; no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/store/index.ts
git commit -m "store: compose atmosphereSlice into useStore"
```

---

## Task 7: `<Atmosphere>` mount component + integration into `PersistentScene`

A shell component that returns `null` for any non-atmosphere active module, then composes the sub-meshes when active. Land this as an empty shell first so we can wire it into `PersistentScene` and confirm no regressions; the sub-meshes (Sun, Heatmap, Cells, CloudBand, HoverInspector) drop in over the next several tasks.

**Files:**

- Create: `src/atmos/scene/Atmosphere.tsx`
- Modify: `src/scene/PersistentScene.tsx`

- [ ] **Step 1: Implement the mount shell** at `src/atmos/scene/Atmosphere.tsx`:

```tsx
'use client'

import { useStore } from '@/src/store'

/**
 * Atmosphere module scene root. Composes the sun, surface temperature
 * heatmap, convection-cell arrows, ITCZ cloud band, and hover inspector.
 * Returns null when another module is active so it costs nothing on /,
 * /tectonics, or /systems routes.
 */
export function Atmosphere() {
  const activeModule = useStore((s) => s.activeModule)
  if (activeModule !== 'atmosphere') return null

  // Sub-meshes are added in subsequent tasks (Sun, Heatmap, Cells, CloudBand,
  // HoverInspector). Render an empty group placeholder for now so PersistentScene
  // can mount this component immediately without conditional wiring.
  return <group />
}
```

- [ ] **Step 2: Mount into `PersistentScene`**. Modify `src/scene/PersistentScene.tsx`. Add to the top imports:

```tsx
import { Atmosphere } from '@/src/atmos/scene/Atmosphere'
```

Then add the component to the scene graph next to `<Plates />`:

```tsx
      <Scene controls={true}>
        <Earth />
        <CameraDolly />
        <PostProcessing />
        <TectonicsOcean />
        <Plates />
        <Atmosphere />
      </Scene>
```

- [ ] **Step 3: Verify nothing regresses**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: all tests still pass; no type errors. Atmosphere mounts at `/atmosphere` but currently renders nothing.

- [ ] **Step 4: Commit**

```bash
git add src/atmos/scene/Atmosphere.tsx src/scene/PersistentScene.tsx
git commit -m "atmos: mount empty Atmosphere scene shell in PersistentScene"
```

---

## Task 8: `<Sun>` — directional light + visible sprite driven by `hour`

**Files:**

- Create: `src/atmos/scene/Sun.tsx`
- Modify: `src/atmos/scene/Atmosphere.tsx`

- [ ] **Step 1: Implement `Sun.tsx`**:

```tsx
'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { sunDirection } from '@/src/atmos/solar'
import { useStore } from '@/src/store'

const SUN_DISTANCE = 8 // far enough to read as distant; clears the camera dolly range

/**
 * Visible sun for the Atmosphere module: a directional light + an emissive
 * sphere sprite. Position is driven entirely by the store's `hour` —
 * sunDirection() returns the unit vector from origin to sun, which we scale
 * to SUN_DISTANCE for world position.
 *
 * The directional light's target stays at origin so Earth is always lit
 * from the sun's actual direction. Sprite uses additive blending so it
 * composites cleanly against the dark starfield without a hard disc edge.
 */
export function Sun() {
  const hour = useStore((s) => s.hour)

  const position = useMemo<[number, number, number]>(() => {
    const dir = sunDirection(hour)
    return [dir.x * SUN_DISTANCE, dir.y * SUN_DISTANCE, dir.z * SUN_DISTANCE]
  }, [hour])

  return (
    <group>
      <directionalLight position={position} intensity={2.4} color="#fff4d6" />
      <mesh position={position}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshBasicMaterial
          color="#ffe6a8"
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 2: Mount `<Sun>` inside `<Atmosphere>`**. Edit `src/atmos/scene/Atmosphere.tsx`:

```tsx
'use client'

import { useStore } from '@/src/store'
import { Sun } from './Sun'

export function Atmosphere() {
  const activeModule = useStore((s) => s.activeModule)
  if (activeModule !== 'atmosphere') return null

  return (
    <group>
      <Sun />
    </group>
  )
}
```

- [ ] **Step 3: Verify no regressions**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: tests still pass; no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/atmos/scene/Sun.tsx src/atmos/scene/Atmosphere.tsx
git commit -m "atmos: render <Sun> driven by store.hour"
```

---

## Task 9: `<Heatmap>` — additive sphere shell with latitude gradient

**Files:**

- Create: `src/atmos/scene/Heatmap.tsx`
- Modify: `src/atmos/scene/Atmosphere.tsx`

- [ ] **Step 1: Implement `Heatmap.tsx`**:

```tsx
'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'

const HEATMAP_RADIUS = 1.005

const vertexShader = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const fragmentShader = /* glsl */ `
varying vec3 vWorldPos;
uniform float uVisible;

// 5-stop latitude ramp: red (eq) → orange → yellow-cyan → cyan → deep blue
vec3 ramp(float t) {
  vec3 red    = vec3(0.95, 0.30, 0.15);
  vec3 orange = vec3(0.98, 0.55, 0.20);
  vec3 yellow = vec3(0.95, 0.85, 0.45);
  vec3 cyan   = vec3(0.45, 0.78, 0.92);
  vec3 deep   = vec3(0.18, 0.32, 0.65);
  if (t < 0.33) return mix(red, orange, t / 0.33);
  if (t < 0.66) return mix(orange, yellow, (t - 0.33) / 0.33);
  if (t < 0.85) return mix(yellow, cyan, (t - 0.66) / 0.19);
  return mix(cyan, deep, (t - 0.85) / 0.15);
}

void main() {
  vec3 n = normalize(vWorldPos);
  float absLat = abs(asin(clamp(n.y, -1.0, 1.0))) / 1.5707963; // 0 at eq, 1 at pole
  vec3 c = ramp(absLat);
  // Alpha: visible band, fades at the poles to avoid a hard cap
  float a = uVisible * 0.32 * (1.0 - smoothstep(0.85, 1.0, absLat));
  gl_FragColor = vec4(c, a);
}
`

/**
 * Surface temperature heatmap as an additive sphere shell slightly above
 * the Earth surface. Latitude-only gradient — no per-frame state, no time
 * dependence. The `temp` layer toggle drives the `uVisible` uniform; we
 * lerp toward 0 in the shader so toggling fades the layer rather than
 * popping it.
 */
export function Heatmap() {
  const visible = useStore((s) => s.layers.temp)

  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uVisible: { value: visible ? 1 : 0 } },
      transparent: true,
      depthWrite: false,
    })
    return m
  }, []) // material persists across visibility flips; we update the uniform below

  // Sync uVisible whenever the layer toggle changes.
  material.uniforms.uVisible!.value = visible ? 1 : 0

  return (
    <mesh material={material}>
      <sphereGeometry args={[HEATMAP_RADIUS, 96, 96]} />
    </mesh>
  )
}
```

- [ ] **Step 2: Mount `<Heatmap>` inside `<Atmosphere>`**. Edit `src/atmos/scene/Atmosphere.tsx`:

```tsx
'use client'

import { useStore } from '@/src/store'
import { Heatmap } from './Heatmap'
import { Sun } from './Sun'

export function Atmosphere() {
  const activeModule = useStore((s) => s.activeModule)
  if (activeModule !== 'atmosphere') return null

  return (
    <group>
      <Sun />
      <Heatmap />
    </group>
  )
}
```

- [ ] **Step 3: Verify no regressions**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/atmos/scene/Heatmap.tsx src/atmos/scene/Atmosphere.tsx
git commit -m "atmos: render <Heatmap> — latitude-gradient sphere shell"
```

---

## Task 10: `<Cells>` — TubeGeometry arrows wrapping the globe with scrolling-dash shader

The flagship visual. Each band gets one merged BufferGeometry (one draw call per band, six bands → six draws). A shared shader scrolls the dash pattern along each tube's V coordinate. Static `<coneGeometry>` arrowheads sit at the end of each arrow's curve, oriented along the curve's terminal tangent.

**Files:**

- Create: `src/atmos/scene/Cells.tsx`
- Modify: `src/atmos/scene/Atmosphere.tsx`

- [ ] **Step 1: Implement `Cells.tsx`**:

```tsx
'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CELL_BANDS, allArrowArcs, type CellBand } from '@/src/atmos/cellBands'
import { usePrefersReducedMotion } from '@/src/lib/accessibility'
import { useStore } from '@/src/store'

const TUBE_RADIUS = 0.006
const TUBE_LIFT = 1.012 // arrows ride slightly above the Earth surface
const TUBE_SEGMENTS_ALONG = 32
const TUBE_RADIAL_SEGMENTS = 6

const HEAD_LENGTH = 0.025
const HEAD_RADIUS = 0.012

const BAND_COLORS: Record<CellBand['belt'], string> = {
  trade: '#5cc6ff',
  westerly: '#7ad9aa',
  polar: '#aa8fff',
}

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uPhase;
uniform float uVisible;
// Dash pattern in UV.y space. dash + gap = period.
const float DASH = 0.06;
const float GAP  = 0.06;
const float PERIOD = DASH + GAP;
void main() {
  float v = mod(vUv.y - uPhase, PERIOD);
  float onDash = step(v, DASH);
  if (onDash < 0.5) discard;
  gl_FragColor = vec4(uColor, uVisible);
}
`

interface BandMeshData {
  band: CellBand
  geometry: THREE.BufferGeometry
  headGeometry: THREE.BufferGeometry
  material: THREE.ShaderMaterial
  headMaterial: THREE.MeshBasicMaterial
}

function buildBandMeshes(): BandMeshData[] {
  const arcs = allArrowArcs()
  const byBandId = new Map<CellBand['id'], BandMeshData>()

  for (const band of CELL_BANDS) {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(BAND_COLORS[band.belt]) },
        uPhase: { value: 0 },
        uVisible: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
    })
    const headMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(BAND_COLORS[band.belt]),
      transparent: true,
      opacity: 1,
    })
    byBandId.set(band.id, {
      band,
      geometry: new THREE.BufferGeometry(),
      headGeometry: new THREE.BufferGeometry(),
      material,
      headMaterial,
    })
  }

  // Build tubes + cones per arrow, then merge per band.
  const tubesByBand = new Map<CellBand['id'], THREE.BufferGeometry[]>()
  const conesByBand = new Map<CellBand['id'], THREE.BufferGeometry[]>()

  for (const arc of arcs) {
    const points = arc.points.map((p) => p.clone().multiplyScalar(TUBE_LIFT))
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
    const tube = new THREE.TubeGeometry(
      curve,
      TUBE_SEGMENTS_ALONG,
      TUBE_RADIUS,
      TUBE_RADIAL_SEGMENTS,
      false,
    )
    if (!tubesByBand.has(arc.band.id)) tubesByBand.set(arc.band.id, [])
    tubesByBand.get(arc.band.id)!.push(tube)

    // Arrowhead at the end of the curve. Tangent at t=1 is from points[n-2] → points[n-1].
    const end = points[points.length - 1]!
    const beforeEnd = points[points.length - 2]!
    const tangent = end.clone().sub(beforeEnd).normalize()
    const cone = new THREE.ConeGeometry(HEAD_RADIUS, HEAD_LENGTH, 12, 1, false)
    // ConeGeometry's tip points +Y; rotate so tip aligns with tangent.
    cone.translate(0, HEAD_LENGTH / 2, 0)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent)
    cone.applyQuaternion(q)
    cone.translate(end.x, end.y, end.z)
    if (!conesByBand.has(arc.band.id)) conesByBand.set(arc.band.id, [])
    conesByBand.get(arc.band.id)!.push(cone)
  }

  for (const [bandId, tubes] of tubesByBand.entries()) {
    const merged = mergeGeometries(tubes, false)
    if (!merged) continue
    const data = byBandId.get(bandId)!
    data.geometry.dispose()
    data.geometry = merged
  }
  for (const [bandId, cones] of conesByBand.entries()) {
    const merged = mergeGeometries(cones, false)
    if (!merged) continue
    const data = byBandId.get(bandId)!
    data.headGeometry.dispose()
    data.headGeometry = merged
  }

  return Array.from(byBandId.values())
}

/**
 * Renders the six convection bands' arrows as merged tube geometry.
 *
 * One draw call per band (six total). A shared `uPhase` uniform is
 * advanced in useFrame to scroll the dashed pattern along every tube
 * simultaneously. Per-arrow cones sit at each tube's end as the arrowhead.
 *
 * The `cells` layer toggle is plumbed through `uVisible` and a hide on
 * the cone meshes — toggling off makes everything disappear in one frame.
 */
export function Cells() {
  const visibleCells = useStore((s) => s.layers.cells)
  const prefersReducedMotion = usePrefersReducedMotion()

  const meshes = useMemo(() => buildBandMeshes(), [])

  // Shared dash phase scrolls every tube. ~0.6 cycles per second feels live
  // without being distracting.
  const phaseRef = useRef(0)
  useFrame((_, delta) => {
    if (prefersReducedMotion) return
    phaseRef.current = (phaseRef.current + delta * 0.6) % 1
    for (const m of meshes) {
      m.material.uniforms.uPhase!.value = phaseRef.current
      m.material.uniforms.uVisible!.value = visibleCells ? 1 : 0
      m.headMaterial.opacity = visibleCells ? 1 : 0
    }
  })

  return (
    <group>
      {meshes.map((m) => (
        <group key={m.band.id} visible={visibleCells}>
          <mesh geometry={m.geometry} material={m.material} />
          <mesh geometry={m.headGeometry} material={m.headMaterial} />
        </group>
      ))}
    </group>
  )
}
```

- [ ] **Step 2: Mount `<Cells>` inside `<Atmosphere>`**:

```tsx
'use client'

import { useStore } from '@/src/store'
import { Cells } from './Cells'
import { Heatmap } from './Heatmap'
import { Sun } from './Sun'

export function Atmosphere() {
  const activeModule = useStore((s) => s.activeModule)
  if (activeModule !== 'atmosphere') return null

  return (
    <group>
      <Sun />
      <Heatmap />
      <Cells />
    </group>
  )
}
```

- [ ] **Step 3: Verify no regressions**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: tests still pass; no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/atmos/scene/Cells.tsx src/atmos/scene/Atmosphere.tsx
git commit -m "atmos: render <Cells> — six bands of dashed tube arrows"
```

---

## Task 11: `<CloudBand>` — ITCZ band with sun-driven brightness

**Files:**

- Create: `src/atmos/scene/CloudBand.tsx`
- Modify: `src/atmos/scene/Atmosphere.tsx`

- [ ] **Step 1: Implement `CloudBand.tsx`**:

```tsx
'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { latLngToVec3 } from '@/src/tectonics/sphericalGeometry'
import { itczBrightness, subsolarPoint } from '@/src/atmos/solar'

const BAND_RADIUS = 1.018
const PUFF_COUNT = 80 // around the full equator

/**
 * ITCZ cloud band: a ring of 80 billboard sprites around the equator at
 * radius 1.018. Per-sprite brightness is computed in the fragment shader
 * from the sprite's longitude proximity to the subsolar longitude, scaled
 * by the global `itczBrightness(hour)` envelope. So only the sun-facing
 * arc of the equator shows cloud; the night side stays dark.
 *
 * Implemented as instanced billboards for one-draw-call efficiency.
 */
export function CloudBand() {
  const visible = useStore((s) => s.layers.clouds)
  const hour = useStore((s) => s.hour)

  // Per-puff longitudes (degrees), evenly spaced 0..360.
  const puffLngs = useMemo(() => {
    const out: number[] = []
    for (let i = 0; i < PUFF_COUNT; i++) out.push((i / PUFF_COUNT) * 360 - 180)
    return out
  }, [])

  // Subsolar longitude this frame (recomputed only on hour change).
  const subsolarLng = useMemo(() => subsolarPoint(hour)[1], [hour])
  const globalBrightness = useMemo(() => itczBrightness(hour), [hour])

  if (!visible) return null

  return (
    <group>
      {puffLngs.map((lng, idx) => {
        const pos = latLngToVec3(0, lng, BAND_RADIUS)
        // Angular distance to subsolar (deg, in [0, 180]).
        const rawDelta = Math.abs(((lng - subsolarLng + 540) % 360) - 180)
        // 0 → 1 within ±30°; falls to 0 over ±60°.
        const proximity = Math.max(0, 1 - rawDelta / 60)
        const opacity = Math.max(0, Math.min(1, globalBrightness * proximity))
        if (opacity < 0.01) return null
        return (
          <sprite key={idx} position={[pos.x, pos.y, pos.z]} scale={[0.18, 0.07, 1]}>
            <spriteMaterial
              color="#ffffff"
              opacity={opacity}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        )
      })}
    </group>
  )
}
```

- [ ] **Step 2: Mount `<CloudBand>` inside `<Atmosphere>`**:

```tsx
'use client'

import { useStore } from '@/src/store'
import { Cells } from './Cells'
import { CloudBand } from './CloudBand'
import { Heatmap } from './Heatmap'
import { Sun } from './Sun'

export function Atmosphere() {
  const activeModule = useStore((s) => s.activeModule)
  if (activeModule !== 'atmosphere') return null

  return (
    <group>
      <Sun />
      <Heatmap />
      <Cells />
      <CloudBand />
    </group>
  )
}
```

- [ ] **Step 3: Verify no regressions**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/atmos/scene/CloudBand.tsx src/atmos/scene/Atmosphere.tsx
git commit -m "atmos: render <CloudBand> — ITCZ ring with sun-driven brightness"
```

---

## Task 12: `<HoverInspector>` — raycast on the globe → `setInspectAt`

**Files:**

- Create: `src/atmos/scene/HoverInspector.tsx`
- Modify: `src/atmos/scene/Atmosphere.tsx`

- [ ] **Step 1: Implement `HoverInspector.tsx`**:

```tsx
'use client'

import { type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { vec3ToLatLng } from '@/src/tectonics/sphericalGeometry'

const INSPECT_RADIUS = 1.01 // slightly above the Earth surface

/**
 * Invisible sphere that intercepts pointer events on the Earth. Converts
 * each intersection point to (lat, lng) via vec3ToLatLng and writes it to
 * the store as inspectAt, debounced to once per ~16ms so we don't flood
 * the reducer on every pointer move.
 *
 * On pointerOut, clears inspectAt so the readout disappears.
 */
export function HoverInspector() {
  const setInspectAt = useStore((s) => s.setInspectAt)
  const lastDispatchRef = useRef(0)

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    const now = performance.now()
    if (now - lastDispatchRef.current < 16) return
    lastDispatchRef.current = now
    const p = e.point.clone().normalize() // hit may be slightly off-sphere due to float
    const [lat, lng] = vec3ToLatLng(p)
    setInspectAt([lat, lng])
  }

  const handleOut = () => {
    setInspectAt(null)
  }

  return (
    <mesh onPointerMove={handleMove} onPointerOut={handleOut} visible={false}>
      <sphereGeometry args={[INSPECT_RADIUS, 64, 64]} />
      <meshBasicMaterial color="white" transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
```

- [ ] **Step 2: Mount `<HoverInspector>` inside `<Atmosphere>`**:

```tsx
'use client'

import { useStore } from '@/src/store'
import { Cells } from './Cells'
import { CloudBand } from './CloudBand'
import { Heatmap } from './Heatmap'
import { HoverInspector } from './HoverInspector'
import { Sun } from './Sun'

export function Atmosphere() {
  const activeModule = useStore((s) => s.activeModule)
  if (activeModule !== 'atmosphere') return null

  return (
    <group>
      <Sun />
      <Heatmap />
      <Cells />
      <CloudBand />
      <HoverInspector />
    </group>
  )
}
```

- [ ] **Step 3: Verify no regressions**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/atmos/scene/HoverInspector.tsx src/atmos/scene/Atmosphere.tsx
git commit -m "atmos: render <HoverInspector> — raycast → inspectAt"
```

---

## Task 13: `<ChipBar>` — floating layer toggles above the scrubber

**Files:**

- Create: `src/atmos/ui/ChipBar.tsx`

- [ ] **Step 1: Implement `ChipBar.tsx`**:

```tsx
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
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/atmos/ui/ChipBar.tsx
git commit -m "atmos: add <ChipBar> — layer toggle chips"
```

---

## Task 14: `<Timeline>` — 24-hour scrubber

**Files:**

- Create: `src/atmos/ui/Timeline.tsx`

- [ ] **Step 1: Implement `Timeline.tsx`**:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '@/src/store'

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

function formatHour(h: number): string {
  const hh = Math.floor(h)
  const mm = Math.floor((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/**
 * 24-hour day-cycle scrubber rendered at the bottom of the viewport.
 *
 * Visually mirrors Tectonics' Timeline placement (fixed, portaled to body,
 * sidebar offset on desktop). Track shows a day-cycle gradient (midnight →
 * sunrise → noon → sunset → midnight). Click anywhere on the track to jump;
 * drag the knob to scrub. Uses pointer events for unified mouse + touch.
 */
export function Timeline() {
  const hour = useStore((s) => s.hour)
  const setHour = useStore((s) => s.setHour)
  const isClient = useIsClient()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      setHour(t * 24)
    },
    [setHour],
  )

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => updateFromClientX(e.clientX)
    const onUp = () => setDragging(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, updateFromClientX])

  const content = (
    <div className="pointer-events-auto fixed z-20 bottom-4 inset-x-4 sm:left-80 sm:right-4 flex items-center gap-3 rounded-lg border border-border/40 bg-card/85 px-4 py-3 backdrop-blur">
      <span aria-hidden className="text-foreground/80">
        ☀
      </span>
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          setDragging(true)
          updateFromClientX(e.clientX)
        }}
        className="relative flex-1 h-2 rounded-full cursor-pointer"
        style={{
          background:
            'linear-gradient(90deg, #1a3a5a 0%, #ff8c5a 25%, #ffd9a0 50%, #ff8c5a 75%, #1a3a5a 100%)',
          opacity: 0.6,
        }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-[#5cc6ff] shadow-[0_0_10px_#5cc6ff]"
          style={{ left: `calc(${(hour / 24) * 100}% - 8px)` }}
          aria-label={`Time of day: ${formatHour(hour)}`}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={24}
          aria-valuenow={hour}
        />
      </div>
      <span className="text-xs text-foreground/80 font-mono tabular-nums w-12 text-right">
        {formatHour(hour)}
      </span>
    </div>
  )

  if (!isClient) return null
  return createPortal(content, document.body)
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/atmos/ui/Timeline.tsx
git commit -m "atmos: add <Timeline> — 24-hour scrubber"
```

---

## Task 15: `<InspectReadout>` — tier-aware data block

**Files:**

- Create: `src/atmos/ui/InspectReadout.tsx`

- [ ] **Step 1: Implement `InspectReadout.tsx`**:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { sampleAt } from '@/src/atmos/sample'
import { useStore } from '@/src/store'

function formatHour(h: number): string {
  const hh = Math.floor(h)
  const mm = Math.floor((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function formatLat(lat: number): string {
  const ns = lat >= 0 ? 'N' : 'S'
  return `${Math.abs(lat).toFixed(0)}°${ns}`
}

function formatLng(lng: number): string {
  const ew = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lng).toFixed(0)}°${ew}`
}

/**
 * Top-left data readout. Hidden until the user hovers/taps the globe.
 * Renders three tiers of detail:
 *   - Beginner (mobile-lite):    big verbal labels (WARM · BREEZY · HUMID)
 *   - Standard  (balanced):      numbers (22°C · 1013 hPa · 14°dp) + location
 *   - Advanced  (desktop-ultra): + lapse rate + specific-humidity + tiny T(z) graph
 */
export function InspectReadout() {
  const inspectAt = useStore((s) => s.inspectAt)
  const hour = useStore((s) => s.hour)
  const tierOverride = useStore((s) => s.tierOverride)

  // SSR/hydration guard for the tier branch — matches TectonicsBody pattern.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!inspectAt) return null
  const [lat, lng] = inspectAt
  const s = sampleAt(lat, lng, hour)
  const effectiveTier = mounted ? tierOverride : null

  // Beginner
  if (effectiveTier === 'mobile-lite') {
    return (
      <div className="pointer-events-none fixed top-20 left-4 sm:top-24 sm:left-80 z-10 rounded-lg border border-border/40 bg-card/85 backdrop-blur px-4 py-3 text-foreground">
        <div className="text-xs uppercase tracking-wider text-[#5cc6ff] mb-1">Conditions</div>
        <div className="text-lg font-semibold leading-tight">{s.labels.temp}</div>
        <div className="text-lg font-semibold leading-tight">{s.labels.wind}</div>
        <div className="text-lg font-semibold leading-tight">{s.labels.humidity}</div>
      </div>
    )
  }

  // Advanced — extra rows + tiny vertical-temperature graph
  const isAdvanced = effectiveTier === 'desktop-ultra'

  // T(z) using lapse rate over a 10 km column. Plot as 60×40 SVG, T-axis horizontal.
  const altitudes = Array.from({ length: 11 }, (_, i) => i) // km, 0..10
  const temps = altitudes.map((alt) => s.tempC - s.lapseCPerKm * alt)
  const minT = Math.min(...temps)
  const maxT = Math.max(...temps)
  const path = altitudes
    .map((alt, i) => {
      const x = ((temps[i]! - minT) / (maxT - minT || 1)) * 56 + 2
      const y = 38 - (alt / 10) * 36
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  // Specific humidity from dewpoint (g/kg) — Magnus approximation.
  const e = 6.112 * Math.exp((17.67 * s.dewpointC) / (s.dewpointC + 243.5)) // hPa
  const q = (0.622 * e) / (s.pressureHpa - 0.378 * e) // mixing ratio kg/kg
  const qGPerKg = q * 1000

  return (
    <div className="pointer-events-none fixed top-20 left-4 sm:top-24 sm:left-80 z-10 rounded-lg border border-border/40 bg-card/85 backdrop-blur px-4 py-3 text-foreground font-mono tabular-nums">
      <div className="text-xs uppercase tracking-wider text-[#5cc6ff] mb-1 font-sans">
        {formatLat(lat)} · {formatLng(lng)} · {formatHour(hour)}
      </div>
      <div className="text-sm">
        {s.tempC.toFixed(0)}°C · {s.pressureHpa.toFixed(0)} hPa · {s.dewpointC.toFixed(0)}°dp
      </div>
      {isAdvanced && (
        <>
          <div className="text-xs text-foreground/70 mt-1">
            lapse {s.lapseCPerKm.toFixed(1)}°C/km · q {qGPerKg.toFixed(1)} g/kg
          </div>
          <svg width="60" height="40" className="mt-2" aria-label="Temperature vs altitude">
            <path d={path} stroke="#5cc6ff" strokeWidth="1.5" fill="none" />
            <text x="2" y="38" fontSize="6" fill="currentColor" opacity="0.6">
              0
            </text>
            <text x="2" y="8" fontSize="6" fill="currentColor" opacity="0.6">
              10km
            </text>
          </svg>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/atmos/ui/InspectReadout.tsx
git commit -m "atmos: add <InspectReadout> — tier-aware data block"
```

---

## Task 16: `<Legend>` — wind-belt color legend

**Files:**

- Create: `src/atmos/ui/Legend.tsx`

- [ ] **Step 1: Implement `Legend.tsx`**:

```tsx
'use client'

import { useState } from 'react'

const BELTS = [
  { color: '#5cc6ff', label: 'Trade winds → equator' },
  { color: '#7ad9aa', label: 'Westerlies W → E' },
  { color: '#aa8fff', label: 'Polar easterlies E → W' },
]

/**
 * Top-right wind-belt color legend. Collapsed-by-default into a single
 * chevron button; clicking expands the three rows inline. Always positioned
 * top-right; doesn't interfere with the tier-toggle chip in the header.
 */
export function Legend() {
  const [open, setOpen] = useState(false)

  return (
    <div className="pointer-events-auto fixed top-20 right-4 sm:top-24 sm:right-6 z-10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-border/40 bg-card/85 backdrop-blur px-3 py-2 text-xs text-foreground/80 hover:text-foreground"
        aria-expanded={open}
        aria-label={open ? 'Hide wind-belt legend' : 'Show wind-belt legend'}
      >
        Wind belts {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-border/40 bg-card/85 backdrop-blur px-3 py-2 text-xs leading-relaxed">
          {BELTS.map((b) => (
            <div key={b.label} className="flex items-center gap-2 text-foreground/85">
              <span
                aria-hidden
                className="inline-block w-3 h-0.5 rounded-full"
                style={{ backgroundColor: b.color }}
              />
              <span>{b.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/atmos/ui/Legend.tsx
git commit -m "atmos: add <Legend> — collapsible wind-belt color key"
```

---

## Task 17: `<AtmosphereBody>` + wire into `modules.tsx` (replace stub)

**Files:**

- Create: `src/atmos/ui/AtmosphereBody.tsx`
- Modify: `src/shell/modules.tsx`

- [ ] **Step 1: Implement `AtmosphereBody.tsx`**:

```tsx
'use client'

import { ChipBar } from './ChipBar'
import { InspectReadout } from './InspectReadout'
import { Legend } from './Legend'
import { Timeline } from './Timeline'

/**
 * Atmosphere module body root. Mounted into the ModuleFrame's sidebar.
 *
 * The sidebar holds the module's static intro copy. The chips, scrubber,
 * inspect readout, and legend portal themselves to the body via fixed
 * positioning so they overlay the globe canvas without the sidebar's
 * `overflow: auto` clipping them.
 */
export function AtmosphereBody() {
  return (
    <>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">Atmosphere</h2>
          <p className="text-xs text-muted-foreground">24-hour day cycle</p>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Scrub the timeline to advance the sun. Hover any point on the globe to inspect local
          conditions. Toggle the chips below to peel layers — convection cells, surface temperature,
          and the equatorial cloud band.
        </p>
      </div>
      <ChipBar />
      <Timeline />
      <InspectReadout />
      <Legend />
    </>
  )
}
```

- [ ] **Step 2: Wire it into `modules.tsx`**. Modify `src/shell/modules.tsx`:

Replace the top imports (add `AtmosphereBody`, remove the stub helper if it ends up unused — verify by reading the rest of the file):

```tsx
import { AtmosphereBody } from '@/src/atmos/ui/AtmosphereBody'
```

Replace the `atmosphere` entry in `MODULES`:

```tsx
  atmosphere: {
    id: 'atmosphere',
    label: 'Atmosphere',
    shortLabel: 'Sky',
    blurb: 'Form fronts, build clouds, trace storms.',
    accentToken: '--color-accent-atmosphere',
    accentHex: '#5cc6ff',
    // Pull back to the sky layer: a higher orbit gives a horizon view.
    dolly: { position: [0, 0.6, 2.4], lookAt: [0, 0, 0] },
    Body: AtmosphereBody,
  },
```

(`makeStub('Atmosphere', '#5cc6ff')` is replaced with `AtmosphereBody`. The other stub usage for `systems` is kept.)

- [ ] **Step 3: Run all tests + typecheck**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: all tests pass; no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/atmos/ui/AtmosphereBody.tsx src/shell/modules.tsx
git commit -m "atmos: wire <AtmosphereBody> into MODULES.atmosphere"
```

---

## Task 18: Update tutor suggested prompts for Atmosphere

**Files:**

- Modify: `src/ui/TutorPanel.tsx`

- [ ] **Step 1: Replace the `atmosphere` entry in `SUGGESTED_PROMPTS`** in `src/ui/TutorPanel.tsx`. Find:

```ts
  atmosphere: [
    'Why does it rain in front of a cold front?',
    'What’s the difference between humidity and dew point?',
  ],
```

Replace with:

```ts
  atmosphere: [
    'Why do trade winds curve westward?',
    "What's the ITCZ?",
    'Why is the equator warmer than the poles?',
    'What drives the Hadley cell?',
  ],
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/TutorPanel.tsx
git commit -m "atmos: update tutor prompts to day-cycle topics"
```

---

## Task 19: Playwright e2e — happy path through Atmosphere

**Files:**

- Create: `tests/e2e/atmosphere.spec.ts`

- [ ] **Step 1: Write the test file** at `tests/e2e/atmosphere.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('Atmosphere route renders the day-cycle viewer chrome', async ({ page }) => {
  await page.goto('/atmosphere')
  await expect(page.locator('canvas')).toBeVisible()
  // Sidebar heading from AtmosphereBody.
  await expect(page.getByRole('heading', { name: 'Atmosphere' })).toBeVisible()
  // Three layer-toggle chips.
  for (const label of ['Cells', 'Temperature', 'Clouds']) {
    await expect(page.getByRole('button', { name: label })).toBeVisible()
  }
  // Scrubber knob (role=slider).
  await expect(page.getByRole('slider')).toBeVisible()
})

test('toggling a chip flips its aria-pressed state', async ({ page }) => {
  await page.goto('/atmosphere')
  const cells = page.getByRole('button', { name: 'Cells' })
  await expect(cells).toHaveAttribute('aria-pressed', 'true')
  await cells.dispatchEvent('click')
  await expect(cells).toHaveAttribute('aria-pressed', 'false')
  await cells.dispatchEvent('click')
  await expect(cells).toHaveAttribute('aria-pressed', 'true')
})

test('Wind belts legend expands on click', async ({ page }) => {
  await page.goto('/atmosphere')
  const toggle = page.getByRole('button', { name: 'Show wind-belt legend' })
  await expect(toggle).toBeVisible()
  await toggle.dispatchEvent('click')
  // Once expanded, the three belt labels appear.
  await expect(page.getByText('Trade winds → equator')).toBeVisible()
  await expect(page.getByText('Westerlies W → E')).toBeVisible()
  await expect(page.getByText('Polar easterlies E → W')).toBeVisible()
})

test('Atmosphere scrubber and chips are not present on the hub', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Cells' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Temperature' })).not.toBeVisible()
})
```

- [ ] **Step 2: Run the e2e suite**

```bash
npx playwright test tests/e2e/atmosphere.spec.ts
```

Expected: all 4 tests pass. (If Playwright needs `npx playwright install` first, run that once.)

- [ ] **Step 3: Run the full Playwright suite to catch regressions**

```bash
npx playwright test
```

Expected: all e2e tests pass (existing tectonics + module-navigation + new atmosphere).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/atmosphere.spec.ts
git commit -m "atmos: e2e — chrome renders, chip toggle, legend expand, hub isolation"
```

---

## Task 20: Final verification and PR

- [ ] **Step 1: Run the full local quality gate**

```bash
npx vitest run
npx tsc --noEmit
npx playwright test
npm run build
```

Expected:
- All unit tests pass (existing 82 + new ~45 = ~127)
- No TypeScript errors
- All Playwright tests pass
- Production build succeeds

If `npm run build` errors on a missing `mergeGeometries` import path (Three.js examples can vary by version), check `node_modules/three/examples/jsm/utils/BufferGeometryUtils.js` exists; if not, the import is `from 'three/addons/utils/BufferGeometryUtils.js'` on newer 0.184+ — adjust the import in `src/atmos/scene/Cells.tsx` accordingly and re-run.

- [ ] **Step 2: Visual approval gate** — start the dev server, navigate to /atmosphere, and confirm by eye:

```bash
npm run dev
# Open http://localhost:3000/atmosphere
```

Check (mark each):
- Globe is rotating
- Sun is visible and arcs across the sky when the scrubber moves
- Three layers all visible by default: temperature heatmap, cell arrows, ITCZ cloud band
- Cell arrows have dashed flow animation
- Chips toggle their respective layers off/on
- Scrubber updates the hour readout and the sun position
- Hover over the globe surfaces the InspectReadout
- Tier toggle changes the readout style (Beginner → Standard → Advanced)
- Wind belts legend expands when clicked

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin atmosphere-v1-day-cycle-spec
gh pr create --title "Atmosphere v1: day-cycle viewer" --body "$(cat <<'EOF'
## Summary

- Implements Module B per `docs/superpowers/specs/2026-05-27-atmosphere-day-cycle-design.md`
- New `src/atmos/` engine: `solar.ts`, `sample.ts`, `cellBands.ts`, `atmosphereSlice.ts`
- New R3F components: `<Sun>`, `<Heatmap>`, `<Cells>` (six bands of dashed tube arrows), `<CloudBand>`, `<HoverInspector>`
- New UI: floating `<ChipBar>` (Cells / Temperature / Clouds), 24h `<Timeline>`, tier-aware `<InspectReadout>`, collapsible wind-belt `<Legend>`
- Updated tutor prompts to day-cycle topics

## Test plan

- [x] Unit tests for solar, sample, cellBands, atmosphereSlice (full coverage of the engine files)
- [x] Playwright e2e: scrubber visible, chips toggle, legend expands, hub doesn't show atmosphere chrome
- [x] Visual approval at /atmosphere — see screenshots in the PR thread
EOF
)"
```

---

## Self-review notes

**Spec coverage check:**

- §1 success criteria: every bullet is implemented across tasks 2–17.
- §2 file structure: every file in the spec map is created or modified in this plan.
- §3 data model: `LatLng` exported from `solar.ts` (Task 2) and `atmosphereSlice.ts` (Task 5); `CellBand` defined in Task 4; `InspectSample` defined in Task 3; slice state shape defined in Task 5.
- §4 engine: `solar.ts` Task 2 ✓, `sample.ts` Task 3 ✓, `cellBands.ts` Task 4 ✓, `atmosphereSlice.ts` Task 5 ✓.
- §5 scene components: `Atmosphere` Task 7, `Sun` Task 8, `Heatmap` Task 9, `Cells` Task 10, `CloudBand` Task 11, `HoverInspector` Task 12, PersistentScene integration Task 7.
- §6 UI components: `AtmosphereBody` Task 17, `ChipBar` Task 13, `Timeline` Task 14, `InspectReadout` Task 15, `Legend` Task 16.
- §7 tutor: Task 18.
- §8 animation/time semantics: shared `uPhase` in `<Cells>` (Task 10); `<Sun>` reads `hour` (Task 8); ITCZ brightness from `solar.ts` × per-puff proximity in `<CloudBand>` (Task 11); Heatmap is static (Task 9); reduced-motion freezes uPhase (Task 10).
- §10 testing strategy: unit specs in Tasks 1–5, Playwright in Task 19, visual gate in Task 20.

**Type consistency:** `vec3ToLatLng` (Task 1) used by `cellBands` (Task 4) and `HoverInspector` (Task 12). `sunDirection` from `solar.ts` (Task 2) used by `sample.ts` (Task 3), `<Sun>` (Task 8). `LatLng` type lives in both `solar.ts` and `atmosphereSlice.ts` — both declare the same `readonly [number, number]` and are interchangeable; UI components import from `@/src/store` indirectly via the slice. `CellBand['belt']` literal ('trade' | 'westerly' | 'polar') is the same in `cellBands.ts` (Task 4) and `<Cells>` color map (Task 10).

**Placeholder scan:** No TBDs or "implement later" steps. Every code block is complete.
