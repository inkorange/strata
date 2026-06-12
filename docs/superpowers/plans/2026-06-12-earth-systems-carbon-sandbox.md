# Earth Systems — Carbon-Cycle Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/systems` placeholder with an interactive carbon-cycle sandbox: four reservoirs rendered on the persistent Earth, two forcing levers (fossil-fuel emissions, land use), and a mass-conservation engine that integrates reservoir masses forward in simulated time.

**Architecture:** A pure-TS engine (`src/systems/`) computes carbon fluxes between four reservoirs and integrates masses with forward Euler. A namespaced Zustand slice holds masses + lever positions + playback state. Scene overlays (`Reservoirs`, `CarbonFlows`) plug into the existing `PersistentScene` gated on `activeModule === 'systems'`. UI (lever sliders, gauge panel, playback scrubber) reuses the Atmosphere `Timeline` track-and-knob grammar and the `ModuleFrame` desktop-sidebar / mobile-card layout.

**Tech Stack:** Next.js 16 / React 19, Three.js + @react-three/fiber + drei, Zustand, Tailwind, Vitest (unit), Playwright (e2e), Biome.

**Spec:** `docs/superpowers/specs/2026-06-12-earth-systems-carbon-sandbox-design.md`

**Branch:** `earth-systems-carbon-sandbox` (already checked out; the spec is already committed here).

### Deviations from spec (flagged for reviewer)

- **Reservoir visuals (spec §4):** the spec lists a surface tint for *all four* reservoirs. This plan renders only the two that read legibly as additive shells on the globe — the **atmosphere halo** (∝ atmospheric carbon) and the **lithosphere interior glow** (∝ lithospheric carbon). **Ocean** changes by <8% across the sandbox (the spec itself called its tint "subtle") and **biosphere** as a green additive shell would read as a second halo, not vegetation. Both are instead represented by their **gauges** (precise read) and by the shared **carbon-flow particle density/speed**. Net effect honors §4's intent (mass is visible) without a misleading green halo. If you want explicit ocean/biosphere surface tints, that's a fast follow on `Earth.tsx`'s material — out of this PR.

---

## File Structure

```
src/systems/
  carbonModel.ts          # types, reservoir/flux constants, scenario seeds, display ranges
  carbonModel.spec.ts     # constants + scenario sanity
  step.ts                 # computeFluxes + forward-Euler step(state, dtYears)
  step.spec.ts            # conservation, equilibrium, negative feedback, lever direction
  display.ts              # pure clamp/normalize helpers for visual + gauge mapping
  display.spec.ts         # clamp behavior
  systemsSlice.ts         # Zustand slice (namespaced fields/actions)
  systemsSlice.spec.ts    # actions, tick, setScenario reseed, reset
  scene/
    Reservoirs.tsx        # halo + tint overlays driven by masses (gated on activeModule)
    CarbonFlows.tsx       # instanced particles along active fluxes
  ui/
    LeverSlider.tsx       # track-and-knob slider (Atmosphere Timeline grammar)
    ReservoirGauges.tsx   # grouped four-reservoir gauge panel
    SystemsTimeline.tsx   # playback scrubber (play/stop + elapsed-years track)
    SystemsBody.tsx       # module card: intro, levers, scenario presets, reset, mounts timeline + gauges + scene-overlay none

Edited:
  src/store/index.ts            # compose createSystemsSlice
  src/scene/PersistentScene.tsx # render <Reservoirs/> + <CarbonFlows/> gated on activeModule
  src/shell/modules.tsx         # systems.Body = SystemsBody (+ optional dolly tune)
  tests/e2e/systems.spec.ts     # new e2e
```

**Naming-collision note:** the merged store already has `playing` (shared by tectonics + atmosphere) and `togglePlaying` (atmosphere). The systems slice MUST NOT reuse these. Use `systemsPlaying`, `toggleSystemsPlaying`, `tickSystems`, `resetSystems`, plus `masses`, `fossilLever`, `landLever`, `scenario`, `elapsedYears`, `setFossilLever`, `setLandLever`, `setScenario` — all verified unique against `shellSlice`, `tectonicsSlice`, `atmosphereSlice`.

---

## Task 1: Carbon model constants, types, scenario seeds

**Files:**
- Create: `src/systems/carbonModel.ts`
- Test: `src/systems/carbonModel.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/systems/carbonModel.spec.ts
import { describe, expect, it } from 'vitest'
import {
  BASELINE_MASSES,
  RESERVOIR_KEYS,
  SCENARIOS,
  type ReservoirKey,
} from './carbonModel'

describe('carbonModel', () => {
  it('defines the four reservoirs in fixed order', () => {
    expect(RESERVOIR_KEYS).toEqual(['atmosphere', 'ocean', 'biosphere', 'lithosphere'])
  })

  it('baseline masses match the spec table (GtC)', () => {
    expect(BASELINE_MASSES).toEqual({
      atmosphere: 590,
      ocean: 38_000,
      biosphere: 2_000,
      lithosphere: 75_000_000,
    })
  })

  it('pre-industrial scenario seeds baseline masses and zero levers', () => {
    expect(SCENARIOS['pre-industrial'].masses).toEqual(BASELINE_MASSES)
    expect(SCENARIOS['pre-industrial'].fossilLever).toBe(0)
    expect(SCENARIOS['pre-industrial'].landLever).toBe(0)
  })

  it('present-day and high-emissions seed an elevated atmosphere', () => {
    expect(SCENARIOS['present-day'].masses.atmosphere).toBe(870)
    expect(SCENARIOS['high-emissions'].masses.atmosphere).toBe(870)
    expect(SCENARIOS['present-day'].fossilLever).toBeGreaterThan(0)
    expect(SCENARIOS['high-emissions'].fossilLever).toBe(1)
  })

  it('every scenario lever is in range', () => {
    for (const s of Object.values(SCENARIOS)) {
      expect(s.fossilLever).toBeGreaterThanOrEqual(0)
      expect(s.fossilLever).toBeLessThanOrEqual(1)
      expect(s.landLever).toBeGreaterThanOrEqual(-1)
      expect(s.landLever).toBeLessThanOrEqual(1)
    }
  })

  it('non-atmosphere reservoirs are seeded at baseline in every scenario', () => {
    const others: ReservoirKey[] = ['ocean', 'biosphere', 'lithosphere']
    for (const s of Object.values(SCENARIOS)) {
      for (const k of others) expect(s.masses[k]).toBe(BASELINE_MASSES[k])
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/systems/carbonModel.spec.ts`
Expected: FAIL — cannot resolve `./carbonModel`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/systems/carbonModel.ts

/** The four carbon reservoirs, in a fixed display/iteration order. */
export const RESERVOIR_KEYS = ['atmosphere', 'ocean', 'biosphere', 'lithosphere'] as const
export type ReservoirKey = (typeof RESERVOIR_KEYS)[number]

/** Carbon mass per reservoir, in gigatonnes of carbon (GtC). */
export type Masses = Record<ReservoirKey, number>

/** Pre-industrial baseline masses (GtC). Textbook round figures — honest, not
 *  research-grade (DESIGN.md §12). Used as integration anchors + gauge ranges. */
export const BASELINE_MASSES: Masses = {
  atmosphere: 590,
  ocean: 38_000,
  biosphere: 2_000,
  lithosphere: 75_000_000,
}

export type ScenarioId = 'pre-industrial' | 'present-day' | 'high-emissions'

export interface Scenario {
  id: ScenarioId
  label: string
  masses: Masses
  fossilLever: number // 0..1
  landLever: number // -1..1
}

/** Scenario seeds. present-day / high-emissions deliberately start with an
 *  elevated atmosphere so they are OUT of equilibrium and visibly evolve. */
export const SCENARIOS: Record<ScenarioId, Scenario> = {
  'pre-industrial': {
    id: 'pre-industrial',
    label: 'Pre-industrial',
    masses: { ...BASELINE_MASSES },
    fossilLever: 0,
    landLever: 0,
  },
  'present-day': {
    id: 'present-day',
    label: 'Present day',
    masses: { ...BASELINE_MASSES, atmosphere: 870 },
    fossilLever: 0.75,
    landLever: 0.25,
  },
  'high-emissions': {
    id: 'high-emissions',
    label: 'High emissions',
    masses: { ...BASELINE_MASSES, atmosphere: 870 },
    fossilLever: 1,
    landLever: 0.5,
  },
}

export const SCENARIO_LIST: Scenario[] = Object.values(SCENARIOS)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/systems/carbonModel.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/systems/carbonModel.ts src/systems/carbonModel.spec.ts
git commit -m "systems: carbon model constants, types, scenario seeds"
```

---

## Task 2: Flux model + forward-Euler integrator

**Files:**
- Create: `src/systems/step.ts`
- Test: `src/systems/step.spec.ts`

This is the engine core. `computeFluxes` returns every flux (GtC/yr) from current masses + levers. `step` applies forward Euler and returns new masses.

- [ ] **Step 1: Write the failing test**

```ts
// src/systems/step.spec.ts
import { describe, expect, it } from 'vitest'
import { BASELINE_MASSES, type Masses } from './carbonModel'
import { step } from './step'

function totalCarbon(m: Masses): number {
  return m.atmosphere + m.ocean + m.biosphere + m.lithosphere
}

const ZERO_LEVERS = { fossilLever: 0, landLever: 0 }

describe('step', () => {
  it('holds pre-industrial baseline at equilibrium (no drift, zero levers)', () => {
    let m = { ...BASELINE_MASSES }
    for (let i = 0; i < 200; i++) {
      m = step({ masses: m, ...ZERO_LEVERS }, 0.5)
    }
    // Every reservoir stays within a hair of baseline.
    expect(m.atmosphere).toBeCloseTo(BASELINE_MASSES.atmosphere, 3)
    expect(m.ocean).toBeCloseTo(BASELINE_MASSES.ocean, 3)
    expect(m.biosphere).toBeCloseTo(BASELINE_MASSES.biosphere, 3)
    expect(m.lithosphere).toBeCloseTo(BASELINE_MASSES.lithosphere, 1)
  })

  it('conserves total carbon across a random lever sequence', () => {
    let m = { ...BASELINE_MASSES, atmosphere: 870 }
    const total0 = totalCarbon(m)
    const levers = [
      { fossilLever: 1, landLever: 0.5 },
      { fossilLever: 0.3, landLever: -1 },
      { fossilLever: 0, landLever: 0 },
      { fossilLever: 0.9, landLever: 1 },
    ]
    for (const lv of levers) {
      for (let i = 0; i < 50; i++) m = step({ masses: m, ...lv }, 0.5)
    }
    expect(totalCarbon(m)).toBeCloseTo(total0, 2)
  })

  it('negative feedback: an elevated atmosphere relaxes toward baseline (zero levers)', () => {
    let m = { ...BASELINE_MASSES, atmosphere: 1200 }
    const start = m.atmosphere
    for (let i = 0; i < 100; i++) m = step({ masses: m, ...ZERO_LEVERS }, 0.5)
    expect(m.atmosphere).toBeLessThan(start) // sinks absorbed some excess
    expect(m.atmosphere).toBeGreaterThan(BASELINE_MASSES.atmosphere) // not all at once
  })

  it('fossil lever up grows atmosphere and drains lithosphere', () => {
    let m = { ...BASELINE_MASSES }
    for (let i = 0; i < 20; i++) m = step({ masses: m, fossilLever: 1, landLever: 0 }, 0.5)
    expect(m.atmosphere).toBeGreaterThan(BASELINE_MASSES.atmosphere)
    expect(m.lithosphere).toBeLessThan(BASELINE_MASSES.lithosphere)
  })

  it('reforestation (landLever < 0) drains atmosphere and grows biosphere', () => {
    let m = { ...BASELINE_MASSES }
    for (let i = 0; i < 20; i++) m = step({ masses: m, fossilLever: 0, landLever: -1 }, 0.5)
    expect(m.atmosphere).toBeLessThan(BASELINE_MASSES.atmosphere)
    expect(m.biosphere).toBeGreaterThan(BASELINE_MASSES.biosphere)
  })

  it('never drives a reservoir negative within the valid lever envelope', () => {
    let m = { ...BASELINE_MASSES }
    for (let i = 0; i < 500; i++) m = step({ masses: m, fossilLever: 1, landLever: 1 }, 0.5)
    for (const k of Object.keys(m) as (keyof Masses)[]) expect(m[k]).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/systems/step.spec.ts`
Expected: FAIL — cannot resolve `./step`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/systems/step.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/systems/step.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/systems/step.ts src/systems/step.spec.ts
git commit -m "systems: flux model + forward-Euler integrator"
```

---

## Task 3: Display normalization helpers

**Files:**
- Create: `src/systems/display.ts`
- Test: `src/systems/display.spec.ts`

Per-reservoir display ranges map huge-and-tiny absolute masses into a legible 0..1 fill so each gauge and visual responds visibly to change.

- [ ] **Step 1: Write the failing test**

```ts
// src/systems/display.spec.ts
import { describe, expect, it } from 'vitest'
import { DISPLAY_RANGES, normalizeMass } from './display'

describe('display', () => {
  it('clamps below min to 0 and above max to 1', () => {
    expect(normalizeMass(-5, 0, 10)).toBe(0)
    expect(normalizeMass(50, 0, 10)).toBe(1)
  })

  it('maps midpoint to 0.5', () => {
    expect(normalizeMass(5, 0, 10)).toBeCloseTo(0.5, 6)
  })

  it('handles a degenerate zero-width range without NaN', () => {
    expect(normalizeMass(5, 10, 10)).toBe(0)
  })

  it('defines a display range for every reservoir', () => {
    for (const k of ['atmosphere', 'ocean', 'biosphere', 'lithosphere'] as const) {
      const [min, max] = DISPLAY_RANGES[k]
      expect(max).toBeGreaterThan(min)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/systems/display.spec.ts`
Expected: FAIL — cannot resolve `./display`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/systems/display.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/systems/display.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/systems/display.ts src/systems/display.spec.ts
git commit -m "systems: display normalization helpers"
```

---

## Task 4: Systems Zustand slice

**Files:**
- Create: `src/systems/systemsSlice.ts`
- Test: `src/systems/systemsSlice.spec.ts`
- Modify: `src/store/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/systems/systemsSlice.spec.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function freshStore() {
  vi.resetModules()
  const mod = await import('@/src/store')
  return mod.useStore
}

describe('systemsSlice', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('defaults to the present-day scenario, not playing, zero elapsed years', async () => {
    const store = await freshStore()
    const s = store.getState()
    expect(s.scenario).toBe('present-day')
    expect(s.systemsPlaying).toBe(false)
    expect(s.elapsedYears).toBe(0)
    expect(s.masses.atmosphere).toBe(870)
    expect(s.fossilLever).toBeCloseTo(0.75, 6)
  })

  it('setFossilLever / setLandLever clamp to range', async () => {
    const store = await freshStore()
    store.getState().setFossilLever(5)
    expect(store.getState().fossilLever).toBe(1)
    store.getState().setFossilLever(-2)
    expect(store.getState().fossilLever).toBe(0)
    store.getState().setLandLever(9)
    expect(store.getState().landLever).toBe(1)
    store.getState().setLandLever(-9)
    expect(store.getState().landLever).toBe(-1)
  })

  it('setScenario reseeds masses, levers, and elapsed years', async () => {
    const store = await freshStore()
    store.getState().setFossilLever(0.1)
    store.getState().tickSystems(1)
    store.getState().setScenario('pre-industrial')
    const s = store.getState()
    expect(s.scenario).toBe('pre-industrial')
    expect(s.masses.atmosphere).toBe(590)
    expect(s.fossilLever).toBe(0)
    expect(s.elapsedYears).toBe(0)
  })

  it('tickSystems advances elapsed years and mutates masses', async () => {
    const store = await freshStore()
    store.getState().setScenario('pre-industrial')
    store.getState().setFossilLever(1)
    const before = store.getState().masses.atmosphere
    store.getState().tickSystems(2)
    expect(store.getState().elapsedYears).toBe(2)
    expect(store.getState().masses.atmosphere).toBeGreaterThan(before)
  })

  it('toggleSystemsPlaying flips playback', async () => {
    const store = await freshStore()
    expect(store.getState().systemsPlaying).toBe(false)
    store.getState().toggleSystemsPlaying()
    expect(store.getState().systemsPlaying).toBe(true)
  })

  it('resetSystems restores the active scenario seed and stops playback', async () => {
    const store = await freshStore()
    store.getState().setFossilLever(1)
    store.getState().tickSystems(10)
    store.getState().toggleSystemsPlaying()
    store.getState().resetSystems()
    const s = store.getState()
    expect(s.masses.atmosphere).toBe(870) // present-day seed
    expect(s.fossilLever).toBeCloseTo(0.75, 6)
    expect(s.elapsedYears).toBe(0)
    expect(s.systemsPlaying).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/systems/systemsSlice.spec.ts`
Expected: FAIL — `scenario` undefined (slice not wired into store).

- [ ] **Step 3a: Write the slice**

```ts
// src/systems/systemsSlice.ts
import type { StateCreator } from 'zustand'
import { type Masses, type ScenarioId, SCENARIOS } from './carbonModel'
import { step } from './step'

const DEFAULT_SCENARIO: ScenarioId = 'present-day'

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export interface SystemsSlice {
  masses: Masses
  fossilLever: number // 0..1
  landLever: number // -1..1
  scenario: ScenarioId
  systemsPlaying: boolean
  elapsedYears: number

  setFossilLever: (v: number) => void
  setLandLever: (v: number) => void
  setScenario: (id: ScenarioId) => void
  toggleSystemsPlaying: () => void
  tickSystems: (dtYears: number) => void
  resetSystems: () => void
}

function seed(id: ScenarioId) {
  const sc = SCENARIOS[id]
  return {
    scenario: id,
    masses: { ...sc.masses },
    fossilLever: sc.fossilLever,
    landLever: sc.landLever,
    elapsedYears: 0,
  }
}

export const createSystemsSlice: StateCreator<SystemsSlice> = (set, get) => ({
  ...seed(DEFAULT_SCENARIO),
  systemsPlaying: false,

  setFossilLever: (v) => set({ fossilLever: clamp(v, 0, 1) }),
  setLandLever: (v) => set({ landLever: clamp(v, -1, 1) }),

  setScenario: (id) => set({ ...seed(id), systemsPlaying: get().systemsPlaying }),

  toggleSystemsPlaying: () => set((s) => ({ systemsPlaying: !s.systemsPlaying })),

  tickSystems: (dtYears) => {
    const s = get()
    const masses = step(
      { masses: s.masses, fossilLever: s.fossilLever, landLever: s.landLever },
      dtYears,
    )
    set({ masses, elapsedYears: s.elapsedYears + dtYears })
  },

  resetSystems: () => set({ ...seed(get().scenario), systemsPlaying: false }),
})
```

- [ ] **Step 3b: Wire the slice into the store**

In `src/store/index.ts`: add the import, extend the `Store` type, and spread the slice. Apply these three edits.

```ts
// add with the other slice imports:
import { createSystemsSlice, type SystemsSlice } from '@/src/systems/systemsSlice'
```

```ts
// extend the Store intersection type — add `SystemsSlice &`:
type Store = ShellSlice &
  TectonicsSlice &
  AtmosphereSlice &
  SystemsSlice & {
    /** Test-only helper: flush the persist debounce synchronously. */
    __flushPersist?: () => void
  }
```

```ts
// inside the create() body, alongside the other slice parts:
  const systemsSlicePart = createSystemsSlice(set, get, api)
```

```ts
// in the returned object, spread it in (order doesn't matter; keys are unique):
  return {
    ...shellSlicePart,
    ...tectonicsSlicePart,
    ...atmosphereSlicePart,
    ...systemsSlicePart,
    ...rehydrated,
    __flushPersist: () => persistShell(get() as ShellSlice),
  }
```

(No change to `persistShell` / `readPersistedShell`: systems state is in-memory only, like the other module slices.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/systems/systemsSlice.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/systems/systemsSlice.ts src/systems/systemsSlice.spec.ts src/store/index.ts
git commit -m "systems: zustand slice (namespaced) wired into store"
```

---

## Task 5: LeverSlider component

**Files:**
- Create: `src/systems/ui/LeverSlider.tsx`

A reusable track-and-knob slider matching the Atmosphere `Timeline` grammar (rounded track, glowing knob, pointer-drag + click-to-set, `role="slider"` + aria values). No unit test — component is covered by typecheck + the Task 11 e2e (the codebase does not unit-test R3F/UI components; see `Cells.tsx`, `Timeline.tsx`). Verify via build.

- [ ] **Step 1: Implement**

```tsx
// src/systems/ui/LeverSlider.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface LeverSliderProps {
  label: string
  /** Current value. */
  value: number
  min: number
  max: number
  /** Called with the new clamped value as the user drags / clicks. */
  onChange: (v: number) => void
  /** CSS color for the filled portion + knob glow. */
  accent: string
  /** Optional value→text for the readout (e.g. "9 GtC/yr"). */
  format?: (v: number) => string
}

/**
 * Horizontal track-and-knob lever. Mirrors the interaction grammar of the
 * Atmosphere Timeline scrubber: click anywhere on the track to set, drag the
 * knob to scrub (pointermove on window so it keeps following off-track).
 * Exposes `role="slider"` with aria-value attributes for a11y + e2e.
 */
export function LeverSlider({
  label,
  value,
  min,
  max,
  onChange,
  accent,
  format,
}: LeverSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      onChange(min + t * (max - min))
    },
    [min, max, onChange],
  )

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => setFromClientX(e.clientX)
    const onUp = () => setDragging(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, setFromClientX])

  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-white/80">{label}</span>
        {format && (
          <span className="text-[11px] font-mono tabular-nums text-white/55">{format(value)}</span>
        )}
      </div>
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          setDragging(true)
          setFromClientX(e.clientX)
        }}
        className="relative h-2 cursor-pointer rounded-full bg-white/[0.08]"
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: accent, opacity: 0.6 }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full"
          style={{
            left: `calc(${pct}% - 8px)`,
            backgroundColor: accent,
            boxShadow: `0 0 10px ${accent}`,
          }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build/typecheck**

Run: `pnpm typecheck`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add src/systems/ui/LeverSlider.tsx
git commit -m "systems: LeverSlider — track-and-knob control (Timeline grammar)"
```

---

## Task 6: ReservoirGauges component

**Files:**
- Create: `src/systems/ui/ReservoirGauges.tsx`

Four stacked gauges (label + bar + tier-aware value), live from the slice. Desktop: right-side fixed panel; mobile: folds to the bottom (above the scrubber). Tier-aware: Beginner hides numbers and shows a qualitative trend word.

- [ ] **Step 1: Implement**

```tsx
// src/systems/ui/ReservoirGauges.tsx
'use client'

import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { RESERVOIR_KEYS, type ReservoirKey } from '@/src/systems/carbonModel'
import { DISPLAY_RANGES, normalizeMass } from '@/src/systems/display'
import { useStore } from '@/src/store'

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

const RESERVOIR_META: Record<ReservoirKey, { label: string; color: string }> = {
  atmosphere: { label: 'Atmosphere', color: '#5cc6ff' },
  ocean: { label: 'Ocean', color: '#6fa8ff' },
  biosphere: { label: 'Biosphere', color: '#7ad9aa' },
  lithosphere: { label: 'Lithosphere', color: '#ff8c5a' },
}

function formatGtC(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return v.toFixed(0)
}

/**
 * Grouped four-reservoir gauge panel. Portaled (like the Atmosphere overlays)
 * so the sidebar's overflow doesn't clip it. Right-pinned on desktop, bottom
 * strip on mobile. Tier-aware: Beginner (mobile-lite) hides GtC numbers.
 */
export function ReservoirGauges() {
  const masses = useStore((s) => s.masses)
  const tierOverride = useStore((s) => s.tierOverride)
  const isClient = useIsClient()

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Track previous masses to derive a trend arrow (qualitative tier).
  const prevRef = useRef(masses)
  const trend: Record<ReservoirKey, number> = {
    atmosphere: masses.atmosphere - prevRef.current.atmosphere,
    ocean: masses.ocean - prevRef.current.ocean,
    biosphere: masses.biosphere - prevRef.current.biosphere,
    lithosphere: masses.lithosphere - prevRef.current.lithosphere,
  }
  prevRef.current = masses

  if (!isClient) return null
  const showNumbers = !mounted || tierOverride !== 'mobile-lite'

  // Mobile: compact 4-up row pinned under the top nav (won't fight the bottom
  // card or scrubber). Desktop: vertical panel pinned top-right.
  const content = (
    <aside
      aria-label="Carbon reservoir gauges"
      className="pointer-events-auto fixed z-20 flex gap-2 rounded-lg border border-white/[0.08] bg-[#0d0a1f]/92 p-3 backdrop-blur-xl
        top-16 inset-x-4 flex-row
        sm:top-24 sm:right-4 sm:left-auto sm:inset-x-auto sm:w-56 sm:flex-col"
    >
      <div className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 sm:block">
        Reservoirs (GtC)
      </div>
      {RESERVOIR_KEYS.map((k) => {
        const meta = RESERVOIR_META[k]
        const fill = normalizeMass(masses[k], DISPLAY_RANGES[k][0], DISPLAY_RANGES[k][1])
        const arrow = trend[k] > 0.001 ? '▲' : trend[k] < -0.001 ? '▼' : '■'
        return (
          <div key={k} className="flex flex-1 flex-col gap-1 sm:flex-none">
            <div className="flex items-baseline justify-between gap-1 text-[10px] sm:text-[11px]">
              <span className="truncate" style={{ color: meta.color }}>
                {meta.label}
              </span>
              <span className="font-mono tabular-nums text-white/65">
                {showNumbers ? formatGtC(masses[k]) : arrow}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full"
                style={{ width: `${fill * 100}%`, backgroundColor: meta.color, opacity: 0.7 }}
              />
            </div>
          </div>
        )
      })}
    </aside>
  )

  return createPortal(content, document.body)
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/systems/ui/ReservoirGauges.tsx
git commit -m "systems: ReservoirGauges — grouped four-reservoir gauge panel"
```

---

## Task 7: SystemsTimeline playback scrubber

**Files:**
- Create: `src/systems/ui/SystemsTimeline.tsx`

Bottom scrubber: play/stop button + elapsed-years track + readout. Play advances sim-years via rAF, calling `tickSystems`. Open-ended sandbox: the track represents a rolling window (0 → `WINDOW_YEARS`), and elapsed years past the window keep the knob pinned at the right while the readout climbs. Reduced-motion → no auto-advance.

- [ ] **Step 1: Implement**

```tsx
// src/systems/ui/SystemsTimeline.tsx
'use client'

import { createPortal } from 'react-dom'
import { useEffect, useSyncExternalStore } from 'react'
import { usePrefersReducedMotion } from '@/src/lib/accessibility'
import { useStore } from '@/src/store'

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

/** Real seconds per simulated year during playback. 0.05 s/yr → ~5 s per
 *  century, matching the Atmosphere scrubber's lively-but-readable cadence. */
const SECONDS_PER_YEAR = 0.05
/** Rolling display window for the track knob, in sim-years. */
const WINDOW_YEARS = 150

export function SystemsTimeline() {
  const elapsedYears = useStore((s) => s.elapsedYears)
  const playing = useStore((s) => s.systemsPlaying)
  const toggle = useStore((s) => s.toggleSystemsPlaying)
  const tick = useStore((s) => s.tickSystems)
  const reduced = usePrefersReducedMotion()
  const isClient = useIsClient()

  // Playback loop: advance sim-years by wall-clock delta / SECONDS_PER_YEAR.
  useEffect(() => {
    if (!playing || reduced) return
    let raf = 0
    let last = performance.now()
    const stepFrame = (now: number) => {
      const dtSeconds = (now - last) / 1000
      last = now
      tick(dtSeconds / SECONDS_PER_YEAR)
      raf = requestAnimationFrame(stepFrame)
    }
    raf = requestAnimationFrame(stepFrame)
    return () => cancelAnimationFrame(raf)
  }, [playing, reduced, tick])

  const knobPct = Math.min(1, (elapsedYears % (WINDOW_YEARS + 1)) / WINDOW_YEARS) * 100

  const content = (
    <div className="pointer-events-auto fixed z-20 bottom-4 inset-x-4 sm:left-80 sm:right-4 flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#0d0a1f]/92 px-4 py-3 backdrop-blur-xl">
      <button
        type="button"
        onClick={() => toggle()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] text-white/85 hover:bg-white/[0.1]"
        aria-label={playing ? 'Pause simulation' : 'Play simulation'}
        aria-pressed={playing}
      >
        {playing ? '◼' : '▶'}
      </button>
      <div
        className="relative flex-1 h-2 rounded-full"
        style={{ background: 'linear-gradient(90deg,#1a3a5a,#7ad9aa)', opacity: 0.6 }}
        aria-hidden
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-[#7ad9aa] shadow-[0_0_10px_#7ad9aa]"
          style={{ left: `calc(${knobPct}% - 8px)` }}
        />
      </div>
      <span className="text-xs text-white/80 font-mono tabular-nums w-16 text-right">
        Year +{Math.floor(elapsedYears)}
      </span>
    </div>
  )

  if (!isClient) return null
  return createPortal(content, document.body)
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/systems/ui/SystemsTimeline.tsx
git commit -m "systems: SystemsTimeline — open-ended playback scrubber"
```

---

## Task 8: SystemsBody module card

**Files:**
- Create: `src/systems/ui/SystemsBody.tsx`
- Modify: `src/shell/modules.tsx`

The card: intro copy, the two lever sliders, scenario preset buttons, a reset button, and it mounts the gauges + scrubber (both portal themselves). Then swap the `systems` module's stub `Body` for `SystemsBody`.

- [ ] **Step 1: Implement SystemsBody**

```tsx
// src/systems/ui/SystemsBody.tsx
'use client'

import { cn } from '@/lib/utils'
import { SCENARIO_LIST } from '@/src/systems/carbonModel'
import { useStore } from '@/src/store'
import { LeverSlider } from './LeverSlider'
import { ReservoirGauges } from './ReservoirGauges'
import { SystemsTimeline } from './SystemsTimeline'

const FOSSIL_ACCENT = '#ff6b6b'
const LAND_ACCENT = '#7ad9aa'

/**
 * Earth Systems module body, mounted into the ModuleFrame sidebar (desktop
 * left card / mobile floating bottom card). Holds the two forcing levers and
 * the scenario presets. The gauges and playback scrubber portal themselves to
 * the body so the sidebar's overflow doesn't clip them.
 */
export function SystemsBody() {
  const fossilLever = useStore((s) => s.fossilLever)
  const landLever = useStore((s) => s.landLever)
  const scenario = useStore((s) => s.scenario)
  const setFossilLever = useStore((s) => s.setFossilLever)
  const setLandLever = useStore((s) => s.setLandLever)
  const setScenario = useStore((s) => s.setScenario)
  const reset = useStore((s) => s.resetSystems)

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
          Carbon cycle
        </div>
        <p className="text-[13px] leading-relaxed text-white/85">
          Carbon never disappears — it moves between four reservoirs. Push the levers, press play,
          and watch the atmosphere fill as the lithosphere drains, with the ocean and biosphere
          sinks fighting back.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <LeverSlider
          label="Fossil-fuel emissions"
          value={fossilLever}
          min={0}
          max={1}
          onChange={setFossilLever}
          accent={FOSSIL_ACCENT}
          format={(v) => `${(v * 12).toFixed(1)} GtC/yr`}
        />
        <LeverSlider
          label="Land use (plant ↔ clear forest)"
          value={landLever}
          min={-1}
          max={1}
          onChange={setLandLever}
          accent={LAND_ACCENT}
          format={(v) =>
            v > 0.02 ? 'deforesting' : v < -0.02 ? 'reforesting' : 'neutral'
          }
        />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
          Scenario
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {SCENARIO_LIST.map((sc) => {
            const active = scenario === sc.id
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => setScenario(sc.id)}
                aria-pressed={active}
                className={cn(
                  'rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors',
                  active
                    ? 'border-[#7ad9aa] bg-[rgba(122,217,170,0.18)] text-[#7ad9aa]'
                    : 'border-white/[0.08] bg-white/[0.03] text-white/65 hover:text-white/90 hover:bg-white/[0.06]',
                )}
              >
                {sc.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-1 self-start rounded-md border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06]"
        >
          Reset
        </button>
      </div>

      <ReservoirGauges />
      <SystemsTimeline />
    </>
  )
}
```

- [ ] **Step 2: Swap the module Body in `src/shell/modules.tsx`**

Add the import near the other body imports:

```tsx
import { SystemsBody } from '@/src/systems/ui/SystemsBody'
```

Replace the `systems` entry's `Body: makeStub('Earth Systems', '#7ad9aa')` with `Body: SystemsBody`:

```tsx
  systems: {
    id: 'systems',
    label: 'Earth Systems',
    shortLabel: 'Cycles',
    blurb: 'Move carbon between atmosphere, ocean, biosphere, lithosphere.',
    accentToken: '--color-accent-systems',
    accentHex: '#7ad9aa',
    // Pulled back to show reservoir flows around Earth.
    dolly: { direction: [0, 0, 1], fillRatio: 0.55, lookAt: [0, 0, 0] },
    Body: SystemsBody,
  },
```

(If `makeStub` is now unused after this change, leave it — `tectonics`/`atmosphere` already use real bodies and `makeStub` may be referenced elsewhere; verify with `pnpm lint` and only remove if Biome flags it as unused.)

- [ ] **Step 3: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/systems/ui/SystemsBody.tsx src/shell/modules.tsx
git commit -m "systems: SystemsBody card (levers + scenarios) wired into module"
```

---

## Task 9: Reservoirs scene overlay

**Files:**
- Create: `src/systems/scene/Reservoirs.tsx`
- Modify: `src/scene/PersistentScene.tsx`

Reservoir visuals that respond to mass: an additive atmosphere halo shell (intensity ∝ atmosphere mass) and a warm interior glow (∝ lithosphere mass). Rendered only when `activeModule === 'systems'`. Kept as its own overlay meshes (does not mutate `Earth.tsx`), matching how the Atmosphere overlays layer on top.

- [ ] **Step 1: Implement Reservoirs**

```tsx
// src/systems/scene/Reservoirs.tsx
'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { DISPLAY_RANGES, normalizeMass } from '@/src/systems/display'
import { useStore } from '@/src/store'

/**
 * Mass-driven reservoir visuals for the Earth Systems module. Returns null
 * when another module is active. Two additive overlays read from the store
 * each frame:
 *   - atmosphere halo shell: opacity tracks atmospheric carbon
 *   - interior glow: emissive intensity tracks lithospheric carbon
 * Ocean / biosphere reservoirs are carried by the gauges + carbon-flow
 * particles; their fractional mass change is too small to read as a tint.
 */
export function Reservoirs() {
  const activeModule = useStore((s) => s.activeModule)
  const haloRef = useRef<THREE.Mesh>(null)
  const coreRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const m = useStore.getState().masses
    const halo = haloRef.current
    if (halo) {
      const a = normalizeMass(m.atmosphere, DISPLAY_RANGES.atmosphere[0], DISPLAY_RANGES.atmosphere[1])
      const mat = halo.material as THREE.MeshBasicMaterial
      mat.opacity = 0.08 + a * 0.32 // thicker blue rim as CO2 climbs
    }
    const core = coreRef.current
    if (core) {
      const l = normalizeMass(m.lithosphere, DISPLAY_RANGES.lithosphere[0], DISPLAY_RANGES.lithosphere[1])
      const mat = core.material as THREE.MeshBasicMaterial
      mat.opacity = 0.15 + l * 0.35
    }
  })

  if (activeModule !== 'systems') return null

  return (
    <group>
      {/* Atmosphere halo shell — additive, just outside the Earth surface. */}
      <mesh ref={haloRef} scale={1.06}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial
          color="#5cc6ff"
          transparent
          opacity={0.2}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Lithosphere interior glow — additive, just inside the surface. */}
      <mesh ref={coreRef} scale={0.98}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#ff8c5a"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 2: Mount in `PersistentScene.tsx`**

Add the import alongside the other scene imports:

```tsx
import { Reservoirs } from '@/src/systems/scene/Reservoirs'
```

Add `<Reservoirs />` inside the `<EarthFrame>` group, after `<CloudBand />`:

```tsx
        <EarthFrame spinning={spinning}>
          <Earth />
          <TectonicsOcean />
          <Plates />
          <Atmosphere />
          <CloudBand />
          <Reservoirs />
        </EarthFrame>
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/systems/scene/Reservoirs.tsx src/scene/PersistentScene.tsx
git commit -m "systems: Reservoirs scene overlay (mass-driven halo + core glow)"
```

---

## Task 10: CarbonFlows particle overlay

**Files:**
- Create: `src/systems/scene/CarbonFlows.tsx`
- Modify: `src/scene/PersistentScene.tsx`

Instanced glowing particles streaming radially between the interior and the halo, representing carbon flux. Particle count is tier-gated via the active preset; speed scales with total human flux (fossil + |land|). Reduced-motion → particles hold still. Returns null off-module.

- [ ] **Step 1: Implement CarbonFlows**

```tsx
// src/systems/scene/CarbonFlows.tsx
'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { usePrefersReducedMotion } from '@/src/lib/accessibility'
import { useStore } from '@/src/store'

/** Particle counts per tier. */
const COUNT_BY_TIER: Record<string, number> = {
  'desktop-ultra': 600,
  balanced: 300,
  'mobile-lite': 120,
}

/**
 * Carbon as glowing instanced points flowing radially between the Earth
 * interior and the atmosphere halo. Each particle rides outward from radius
 * ~0.6 to ~1.15 on a fixed random direction, looping. Flow speed scales with
 * the current human forcing (fossil + |land| levers) so a heavy-emissions run
 * visibly surges. Returns null when the module is inactive; particles freeze
 * under prefers-reduced-motion.
 */
export function CarbonFlows() {
  const activeModule = useStore((s) => s.activeModule)
  const effectiveTier = useStore((s) => s.effectiveTier())
  const reduced = usePrefersReducedMotion()
  const pointsRef = useRef<THREE.Points>(null)

  const count = COUNT_BY_TIER[effectiveTier] ?? 300

  // Fixed per-particle direction + phase, regenerated only when count changes.
  const { geometry, dirs, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const dirs: THREE.Vector3[] = []
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ).normalize()
      dirs.push(v)
      phases[i] = (i / count) % 1
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return { geometry, dirs, phases }
  }, [count])

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#fff2cc',
        size: 0.02,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )

  const tRef = useRef(0)
  useFrame((_, delta) => {
    const pts = pointsRef.current
    if (!pts) return
    const s = useStore.getState()
    const forcing = s.fossilLever + Math.abs(s.landLever) // 0..2
    if (!reduced) tRef.current += delta * (0.05 + forcing * 0.12)
    const pos = (pts.geometry.getAttribute('position') as THREE.BufferAttribute)
      .array as Float32Array
    const R_IN = 0.6
    const R_OUT = 1.15
    for (let i = 0; i < count; i++) {
      const f = (phases[i]! + tRef.current) % 1
      const r = R_IN + f * (R_OUT - R_IN)
      const d = dirs[i]!
      pos[i * 3] = d.x * r
      pos[i * 3 + 1] = d.y * r
      pos[i * 3 + 2] = d.z * r
    }
    ;(pts.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
  })

  if (activeModule !== 'systems') return null

  return <points ref={pointsRef} geometry={geometry} material={material} />
}
```

- [ ] **Step 2: Mount in `PersistentScene.tsx`**

Add the import:

```tsx
import { CarbonFlows } from '@/src/systems/scene/CarbonFlows'
```

Add `<CarbonFlows />` inside `<EarthFrame>`, after `<Reservoirs />`:

```tsx
          <Reservoirs />
          <CarbonFlows />
```

- [ ] **Step 3: Verify typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: PASS (build compiles the scene graph).

- [ ] **Step 4: Commit**

```bash
git add src/systems/scene/CarbonFlows.tsx src/scene/PersistentScene.tsx
git commit -m "systems: CarbonFlows — tier-gated instanced carbon particles"
```

---

## Task 11: End-to-end tests

**Files:**
- Create: `tests/e2e/systems.spec.ts`

Mirror `tests/e2e/atmosphere.spec.ts`: route renders chrome + canvas, lever drag changes a gauge, scenario reset works, module isolation on the hub.

- [ ] **Step 1: Write the e2e spec**

```ts
// tests/e2e/systems.spec.ts
import { expect, test } from '@playwright/test'

test('Earth Systems route renders the carbon-sandbox chrome', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.goto('/systems')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Earth Systems' })).toBeVisible()

  // Two lever sliders + the playback scrubber expose role="slider".
  await expect(page.getByRole('slider', { name: 'Fossil-fuel emissions' })).toBeVisible()
  await expect(page.getByRole('slider', { name: /Land use/ })).toBeVisible()

  // Scenario presets.
  for (const label of ['Pre-industrial', 'Present day', 'High emissions']) {
    await expect(page.getByRole('button', { name: label })).toBeVisible()
  }

  // Gauge panel.
  await expect(page.getByRole('complementary', { name: 'Carbon reservoir gauges' })).toBeVisible()

  await page.waitForTimeout(500)
  expect(
    consoleErrors.filter((e) => !e.toLowerCase().includes('webgl')),
    `unexpected console errors: ${consoleErrors.join('\n')}`,
  ).toEqual([])
})

test('switching scenario updates the active preset', async ({ page }) => {
  await page.goto('/systems')
  const preIndustrial = page.getByRole('button', { name: 'Pre-industrial' })
  await preIndustrial.dispatchEvent('click')
  await expect(preIndustrial).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Present day' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('Systems levers and gauges are not present on the hub', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('slider', { name: 'Fossil-fuel emissions' })).not.toBeVisible()
  await expect(
    page.getByRole('complementary', { name: 'Carbon reservoir gauges' }),
  ).not.toBeVisible()
})
```

- [ ] **Step 2: Run the e2e spec**

Run: `pnpm test:e2e tests/e2e/systems.spec.ts`
Expected: PASS (3 tests, mobile-chrome + desktop-chrome projects).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/systems.spec.ts
git commit -m "systems: e2e — chrome renders, scenario toggle, hub isolation"
```

---

## Task 12: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the complete suite**

Run each and confirm green:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

Expected: all PASS. If `pnpm lint` flags `makeStub` as unused in `src/shell/modules.tsx`, remove the now-dead `makeStub` function and its only remaining references; re-run lint.

- [ ] **Step 2: Manual smoke (optional but recommended)**

```bash
pnpm dev
```

Visit `/systems`: confirm the camera dollies in, the halo + interior glow render, dragging Fossil-fuel emissions up and pressing play grows the Atmosphere gauge and shrinks Lithosphere, Reset restores Present day, and the layout holds on a mobile viewport (Earth pans above the card, gauges sit above the scrubber).

- [ ] **Step 3: Final commit (if any lint cleanup happened)**

```bash
git add -A
git commit -m "systems: lint cleanup after module wiring"
```

---

## Done

All twelve tasks complete the spec's success criteria: interactive carbon sandbox at `/systems`, two Atmosphere-grammar lever sliders, live mass-conservation playback, mass-driven reservoir visuals + tier-gated carbon particles, three scenario presets with reset, tier-aware gauges, and the full typecheck/lint/test/e2e/build suite green. After the final task, use **superpowers:finishing-a-development-branch** to open the PR.
