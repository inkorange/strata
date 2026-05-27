# Tectonics Era Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/tectonics` placeholder with a read-only animated viewer of Earth's plates across 6 geological eras (Pangaea → Future). User clicks a timeline marker, plate vertices SLERP-tween over ~5s to the target era's positions. Play button walks all 6 eras over ~30s.

**Architecture:** Four pure-TS modules under strict TDD (`eras` data, `sphericalGeometry` helpers, `tweenPlates` interpolator, `tectonicsSlice` state machine), two R3F components (`Plates` group + `Plate` mesh) gated on `activeModule`, two UI components (`TectonicsBody` sidebar + `Timeline` bottom strip). All wired into the existing persistent scene + Zustand store + ModuleFrame established by Phases A–F.

**Tech Stack:** Existing project stack — Next.js 16 + React 19 + Three.js 0.184 + R3F 9 + drei 10 + Zustand 5 + Vitest 4 + Playwright 1.60.

**Spec:** `docs/superpowers/specs/2026-05-25-tectonics-era-viewer-design.md`

**Branch:** `tectonics-v1-era-viewer-spec` (already created, spec already committed). All implementation commits land here.

---

## File Structure

Files created in this PR:

```
src/tectonics/
├─ eras.ts                     # 6 Era entries with 7 plates × 6 vertices each
├─ eras.spec.ts                # Data integrity tests
├─ sphericalGeometry.ts        # latLngToVec3, slerpOnSphere, triangulatePolygonFan
├─ sphericalGeometry.spec.ts
├─ tweenPlates.ts              # tweenPlates(source, target, t) → interpolated plates
├─ tweenPlates.spec.ts
├─ tectonicsSlice.ts           # Zustand slice: currentEraId, targetEraId, playing, tween helpers
├─ tectonicsSlice.spec.ts
├─ scene/
│  ├─ Plate.tsx                # Single plate mesh; receives tweened vertices each frame
│  └─ Plates.tsx               # R3F group, useFrame interpolation, conditional on activeModule
└─ ui/
   ├─ TectonicsBody.tsx        # Sidebar: era name + Mya + description (tier-aware)
   └─ Timeline.tsx             # Bottom strip: era markers + Play button
```

Files modified:

- `src/shell/ModuleFrame.tsx` — bump mobile sidebar `max-h-[35dvh]` → `max-h-[45dvh]`
- `src/scene/PersistentScene.tsx` — add `<Plates />` child
- `src/store/index.ts` — merge `createTectonicsSlice` into the combined store
- `src/shell/modules.tsx` — replace `tectonics.Body: makeStub(...)` with `TectonicsBody`

Tests added:

- 4 spec files alongside the pure-TS modules (vitest)
- `tests/e2e/tectonics.spec.ts` — Playwright

---

## Task 1: Bump ModuleFrame mobile sidebar max-height

Smallest task first. Lets the rest of the work assume the new height is in place.

**Files:**
- Modify: `src/shell/ModuleFrame.tsx`

- [ ] **Step 1: Edit the aside className**

In `src/shell/ModuleFrame.tsx`, find the aside element. Its current className contains `max-h-[35dvh]`. Change it to `max-h-[45dvh]`.

The full aside className currently looks roughly like:
```
pointer-events-auto absolute z-10 bg-card/60 backdrop-blur
bottom-0 inset-x-0 max-h-[35dvh] overflow-auto border-t border-border/40
sm:top-20 sm:inset-x-auto sm:left-0 sm:right-auto sm:w-72 sm:h-auto sm:max-h-[70dvh]
sm:border-r sm:border-t-0
```

After the change, replace `max-h-[35dvh]` with `max-h-[45dvh]`. Only that single token changes.

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/shell/ModuleFrame.tsx
git commit -m "Bump ModuleFrame mobile sidebar to max-h-[45dvh]

Tectonics needs the bottom-sheet area to hold an era description plus
a timeline strip. 35dvh isn't enough for both. Bump applies globally
since other modules have less content and won't be affected."
```

---

## Task 2: Era data + integrity tests (strict TDD)

The biggest single content task. Write the data integrity tests first, then the data file. The integrity tests will catch off-by-one or inconsistent vertex counts before downstream tasks consume the data.

**Files:**
- Create: `src/tectonics/eras.ts`
- Create: `src/tectonics/eras.spec.ts`

- [ ] **Step 1: Write the failing tests** at `src/tectonics/eras.spec.ts`

```ts
import { describe, expect, it } from 'vitest'
import { ERAS, type Era, type PlateAtEra, type PlateId } from './eras'

const REQUIRED_PLATE_IDS: ReadonlyArray<PlateId> = [
  'pacific',
  'north-american',
  'eurasian',
  'african',
  'south-american',
  'antarctic',
  'indo-australian',
]

const REQUIRED_ERA_IDS: ReadonlyArray<Era['id']> = [
  'pangaea',
  'late-jurassic',
  'late-cretaceous',
  'eocene',
  'present',
  'future',
]

describe('ERAS', () => {
  it('contains exactly the six required eras in chronological order', () => {
    expect(ERAS).toHaveLength(6)
    expect(ERAS.map((e) => e.id)).toEqual(REQUIRED_ERA_IDS)
  })

  it('orders eras from oldest to newest by mya (descending)', () => {
    const myaValues = ERAS.map((e) => e.mya)
    const sorted = [...myaValues].sort((a, b) => b - a)
    expect(myaValues).toEqual(sorted)
  })

  it.each(REQUIRED_ERA_IDS)('era %s has all seven plates', (eraId) => {
    const era = ERAS.find((e) => e.id === eraId)
    expect(era).toBeDefined()
    if (!era) return
    const plateIds = era.plates.map((p) => p.id).sort()
    expect(plateIds).toEqual([...REQUIRED_PLATE_IDS].sort())
  })

  it.each(REQUIRED_ERA_IDS)('era %s has non-empty descriptions at every tier', (eraId) => {
    const era = ERAS.find((e) => e.id === eraId)
    expect(era).toBeDefined()
    if (!era) return
    expect(era.descriptionBeginner.length).toBeGreaterThan(0)
    expect(era.descriptionStandard.length).toBeGreaterThan(0)
    expect(era.descriptionAdvanced.length).toBeGreaterThan(0)
  })

  it.each(REQUIRED_PLATE_IDS)('plate %s has consistent vertex count across all eras', (plateId) => {
    const counts = ERAS.map((era) => {
      const plate = era.plates.find((p) => p.id === plateId) as PlateAtEra | undefined
      return plate?.vertices.length ?? 0
    })
    const first = counts[0]
    expect(counts.every((c) => c === first)).toBe(true)
    expect(first).toBeGreaterThanOrEqual(6)
    expect(first).toBeLessThanOrEqual(12)
  })

  it('every plate vertex has latitude in [-90, 90] and longitude in [-180, 180]', () => {
    for (const era of ERAS) {
      for (const plate of era.plates) {
        for (const [lat, lng] of plate.vertices) {
          expect(lat).toBeGreaterThanOrEqual(-90)
          expect(lat).toBeLessThanOrEqual(90)
          expect(lng).toBeGreaterThanOrEqual(-180)
          expect(lng).toBeLessThanOrEqual(180)
        }
      }
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/tectonics/eras.spec.ts`
Expected: FAIL with "Cannot find module './eras'".

- [ ] **Step 3: Write `src/tectonics/eras.ts`** — full content below

```ts
export type PlateId =
  | 'pacific'
  | 'north-american'
  | 'eurasian'
  | 'african'
  | 'south-american'
  | 'antarctic'
  | 'indo-australian'

export interface PlateAtEra {
  id: PlateId
  /**
   * Polygon vertices as [latitude, longitude] degree pairs. Order is treated
   * as counterclockwise when viewed from outside the sphere (the standard
   * three.js front-face winding). If a plate renders inside-out at runtime,
   * reverse the array.
   *
   * Range: latitude [-90, 90], longitude [-180, 180]. Each plate has 6
   * vertices in v1. Counts are uniform across eras so tweenPlates can pair
   * vertices index-by-index.
   */
  vertices: ReadonlyArray<readonly [number, number]>
}

export interface Era {
  id: 'pangaea' | 'late-jurassic' | 'late-cretaceous' | 'eocene' | 'present' | 'future'
  name: string
  mya: number
  descriptionBeginner: string
  descriptionStandard: string
  descriptionAdvanced: string
  plates: ReadonlyArray<PlateAtEra>
}

// Vertex data note: these are simplified hand-authored approximations of
// paleogeographic reconstructions, not academic-grade. They preserve the
// big-picture motion (Pangaea -> rifting -> dispersal -> present -> future
// drift) but individual plate shapes are coarse hexagons. Visual refinement
// is expected as a follow-up pass.

export const ERAS: ReadonlyArray<Era> = [
  {
    id: 'pangaea',
    name: 'Pangaea',
    mya: 250,
    descriptionBeginner:
      "All the continents were joined together as one giant landmass called Pangaea, surrounded by one ocean.",
    descriptionStandard:
      "250 million years ago, all continental crust was fused into the supercontinent Pangaea, encircled by the Panthalassic Ocean. Land animals could walk between regions that today are oceans apart.",
    descriptionAdvanced:
      "Late Permian / Early Triassic. Pangaea spans roughly pole to pole along a north-south axis, with Panthalassa as a single global ocean. Subduction along its western margin builds the proto-Andes; the Tethys Sea curls into the eastern interior.",
    plates: [
      { id: 'pacific',         vertices: [[60, -150], [60, 175], [30, 90], [-30, 90], [-60, 175], [-60, -150]] },
      { id: 'north-american',  vertices: [[60, -10], [55, 30], [35, 25], [25, 5], [25, -15], [45, -25]] },
      { id: 'eurasian',        vertices: [[60, 30], [60, 80], [45, 75], [30, 50], [35, 30], [55, 30]] },
      { id: 'african',         vertices: [[25, 5], [30, 50], [0, 60], [-30, 50], [-30, 10], [0, 0]] },
      { id: 'south-american',  vertices: [[25, -15], [25, 5], [0, 0], [-30, -10], [-30, -30], [-5, -30]] },
      { id: 'antarctic',       vertices: [[-60, -150], [-60, -90], [-60, -30], [-60, 30], [-60, 90], [-60, 175]] },
      { id: 'indo-australian', vertices: [[-30, 10], [-30, 50], [-50, 70], [-60, 60], [-60, 10], [-45, 0]] },
    ],
  },
  {
    id: 'late-jurassic',
    name: 'Late Jurassic',
    mya: 150,
    descriptionBeginner:
      "Pangaea was breaking apart. The North Atlantic Ocean started to open as North America split from Africa.",
    descriptionStandard:
      "150 million years ago, the North Atlantic was a narrow rift between North America and northwest Africa. India was still attached to Antarctica. Dinosaurs roamed across the still-connected southern continents.",
    descriptionAdvanced:
      "Late Jurassic. Pangaea has fractured into Laurasia (north) and Gondwana (south). Central Atlantic seafloor spreading is well underway; the South Atlantic has not yet opened. India remains coupled to East Antarctica.",
    plates: [
      { id: 'pacific',         vertices: [[55, -160], [35, -135], [-15, -120], [-55, -140], [-55, 175], [15, 150]] },
      { id: 'north-american',  vertices: [[60, -50], [60, -10], [30, -20], [20, -55], [30, -80], [50, -85]] },
      { id: 'eurasian',        vertices: [[70, 20], [70, 165], [40, 130], [20, 80], [40, 35], [60, 15]] },
      { id: 'african',         vertices: [[25, -5], [25, 50], [-20, 40], [-30, 10], [-15, -10], [10, -15]] },
      { id: 'south-american',  vertices: [[15, -65], [-5, -30], [-50, -50], [-50, -65], [-20, -75], [10, -75]] },
      { id: 'antarctic',       vertices: [[-60, -150], [-60, -90], [-60, -30], [-60, 30], [-60, 90], [-60, 150]] },
      { id: 'indo-australian', vertices: [[0, 65], [-15, 90], [-40, 105], [-55, 100], [-45, 70], [-25, 50]] },
    ],
  },
  {
    id: 'late-cretaceous',
    name: 'Late Cretaceous',
    mya: 90,
    descriptionBeginner:
      "South America and Africa had fully separated, opening the South Atlantic. India was drifting north toward Asia.",
    descriptionStandard:
      "90 million years ago, the South Atlantic was a fully-formed ocean. India had broken from Antarctica and was racing north as a separate plate. North America still touched Europe at its northeastern edge.",
    descriptionAdvanced:
      "Late Cretaceous. South Atlantic rifting is mature; the Mid-Atlantic Ridge runs the full length of the ocean. India is mid-flight toward Asia at unusually high plate velocities (~15 cm/yr). The Pacific is still the dominant ocean basin.",
    plates: [
      { id: 'pacific',         vertices: [[55, -170], [35, -130], [-10, -115], [-55, -135], [-50, 170], [15, 145]] },
      { id: 'north-american',  vertices: [[70, -90], [70, -55], [35, -45], [20, -75], [35, -110], [55, -135]] },
      { id: 'eurasian',        vertices: [[75, 25], [75, 170], [45, 145], [20, 90], [40, 50], [60, 20]] },
      { id: 'african',         vertices: [[30, 0], [30, 45], [-30, 35], [-30, 5], [0, -10], [25, -10]] },
      { id: 'south-american',  vertices: [[10, -70], [-10, -40], [-50, -55], [-55, -75], [-25, -80], [5, -80]] },
      { id: 'antarctic',       vertices: [[-60, -150], [-60, -90], [-60, -30], [-60, 30], [-60, 90], [-60, 150]] },
      { id: 'indo-australian', vertices: [[-5, 70], [-15, 95], [-35, 130], [-50, 145], [-40, 90], [-15, 65]] },
    ],
  },
  {
    id: 'eocene',
    name: 'Eocene',
    mya: 50,
    descriptionBeginner:
      "India crashed into Asia, beginning to push up the Himalaya mountains. The continents looked much like today.",
    descriptionStandard:
      "50 million years ago, the Indo-Australian plate collided with the Eurasian plate; the Himalayas began rising. North America had completed its separation from Europe. Climate was warmer; ice caps were minimal.",
    descriptionAdvanced:
      "Early-mid Eocene. India-Asia collision is ongoing; the Indus and Tsangpo suture zones are active. The Tethys Ocean has closed across most of its length. Australia has begun moving away from Antarctica; the circum-Antarctic current is forming.",
    plates: [
      { id: 'pacific',         vertices: [[55, 175], [35, -135], [-5, -110], [-55, -130], [-50, 170], [15, 145]] },
      { id: 'north-american',  vertices: [[75, -95], [75, -50], [40, -50], [20, -80], [35, -120], [60, -145]] },
      { id: 'eurasian',        vertices: [[75, 30], [75, 170], [50, 150], [20, 105], [40, 50], [60, 15]] },
      { id: 'african',         vertices: [[35, 5], [30, 45], [-35, 35], [-30, 10], [5, -10], [30, -10]] },
      { id: 'south-american',  vertices: [[10, -75], [-10, -40], [-55, -65], [-55, -75], [-25, -80], [5, -85]] },
      { id: 'antarctic',       vertices: [[-60, -150], [-60, -90], [-60, -30], [-60, 30], [-60, 90], [-60, 150]] },
      { id: 'indo-australian', vertices: [[25, 75], [5, 100], [-10, 140], [-45, 155], [-40, 90], [10, 65]] },
    ],
  },
  {
    id: 'present',
    name: 'Present',
    mya: 0,
    descriptionBeginner:
      "Today's plate arrangement. The Atlantic Ocean is still widening; the Pacific is slowly shrinking.",
    descriptionStandard:
      "Today (0 Mya). Seven major plates carry the continents and ocean floor. The Atlantic widens at ~2 cm/yr along the Mid-Atlantic Ridge; the Pacific narrows along its subduction zones around the Ring of Fire.",
    descriptionAdvanced:
      "Present configuration. Active boundaries include: convergent (Andean, Cascadian, Himalayan), divergent (Mid-Atlantic Ridge, East Pacific Rise, East African Rift), and transform (San Andreas, North Anatolian). Mean plate velocities range 1-10 cm/yr.",
    plates: [
      { id: 'pacific',         vertices: [[55, 175], [35, -135], [-5, -105], [-55, -125], [-50, 170], [20, 145]] },
      { id: 'north-american',  vertices: [[75, -100], [75, -50], [40, -55], [20, -85], [35, -125], [60, -150]] },
      { id: 'eurasian',        vertices: [[75, 30], [75, 170], [50, 150], [15, 105], [40, 50], [60, 15]] },
      { id: 'african',         vertices: [[35, 5], [30, 45], [-35, 35], [-35, 10], [5, -10], [35, -10]] },
      { id: 'south-american',  vertices: [[10, -75], [-10, -40], [-55, -65], [-55, -75], [-25, -80], [5, -85]] },
      { id: 'antarctic',       vertices: [[-60, -150], [-60, -90], [-60, -30], [-60, 30], [-60, 90], [-60, 150]] },
      { id: 'indo-australian', vertices: [[35, 70], [5, 100], [-10, 145], [-45, 160], [-40, 90], [15, 65]] },
    ],
  },
  {
    id: 'future',
    name: 'Future (Projected)',
    mya: -50,
    descriptionBeginner:
      "Looking ahead 50 million years: the continents have drifted further. Africa is pushing into Europe, and Australia is closer to Asia.",
    descriptionStandard:
      "Projected configuration 50 million years from now. Atlantic continues to widen, Pacific to shrink. Africa has rotated and is colliding with southern Europe, closing the Mediterranean. Australia drifts north into Southeast Asia.",
    descriptionAdvanced:
      "Forward projection assuming present plate velocities continue. Closure of the Mediterranean basin produces new collision mountains across southern Europe. East African Rift may have separated the Somali subplate as an oceanic basin. The Pacific Ring of Fire compresses as subduction continues.",
    plates: [
      { id: 'pacific',         vertices: [[55, 175], [35, -150], [-5, -115], [-55, -135], [-50, 170], [15, 150]] },
      { id: 'north-american',  vertices: [[75, -105], [75, -45], [45, -50], [25, -80], [40, -125], [60, -155]] },
      { id: 'eurasian',        vertices: [[75, 35], [75, 170], [55, 150], [20, 110], [45, 55], [60, 20]] },
      { id: 'african',         vertices: [[40, 5], [35, 45], [-30, 35], [-30, 10], [5, -10], [35, -10]] },
      { id: 'south-american',  vertices: [[15, -70], [-10, -35], [-55, -60], [-55, -75], [-25, -80], [10, -80]] },
      { id: 'antarctic',       vertices: [[-60, -150], [-60, -90], [-60, -30], [-60, 30], [-60, 90], [-60, 150]] },
      { id: 'indo-australian', vertices: [[40, 75], [10, 100], [-5, 140], [-40, 160], [-35, 90], [15, 70]] },
    ],
  },
]

/** Lookup map for downstream consumers. */
export const ERAS_BY_ID: Record<Era['id'], Era> = Object.fromEntries(
  ERAS.map((era) => [era.id, era]),
) as Record<Era['id'], Era>

/** Display names for each plate. */
export const PLATE_NAMES: Record<PlateId, string> = {
  pacific: 'Pacific',
  'north-american': 'North American',
  eurasian: 'Eurasian',
  african: 'African',
  'south-american': 'South American',
  antarctic: 'Antarctic',
  'indo-australian': 'Indo-Australian',
}

/** Display colors for each plate (additive on top of the Earth surface). */
export const PLATE_COLORS: Record<PlateId, string> = {
  pacific: '#3a8fb8',          // ocean blue
  'north-american': '#c97a5b', // warm rust
  eurasian: '#d4a85c',         // muted gold
  african: '#a3b87a',          // olive
  'south-american': '#b06a8a', // dusty rose
  antarctic: '#dde6ec',        // pale ice
  'indo-australian': '#b9925e',// sandstone
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/tectonics/eras.spec.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tectonics/eras.ts src/tectonics/eras.spec.ts
git commit -m "Add Tectonics era data with integrity tests

Six eras (Pangaea 250 Mya -> Future +50 Mya), each with seven plates
of six vertices. Vertex counts are uniform per plate across eras so
the tweenPlates interpolator can pair vertices index-by-index.

Vertex data is simplified hand-authored approximations of standard
paleogeographic reconstructions - the bar is 'recognizable as Earth
at each era', not academic precision. Visual refinement is expected
as a follow-up tuning pass."
```

---

## Task 3: sphericalGeometry — latLngToVec3 + slerpOnSphere (strict TDD)

Two pure functions in one file. TDD each independently.

**Files:**
- Create: `src/tectonics/sphericalGeometry.ts`
- Create: `src/tectonics/sphericalGeometry.spec.ts`

- [ ] **Step 1: Write the failing tests** at `src/tectonics/sphericalGeometry.spec.ts`

```ts
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { latLngToVec3, slerpOnSphere, triangulatePolygonFan } from './sphericalGeometry'

const FLOAT_TOLERANCE = 1e-6

function approxEqualVec(a: THREE.Vector3, b: THREE.Vector3, tol = FLOAT_TOLERANCE) {
  expect(a.x).toBeCloseTo(b.x, 5)
  expect(a.y).toBeCloseTo(b.y, 5)
  expect(a.z).toBeCloseTo(b.z, 5)
}

describe('latLngToVec3', () => {
  it('maps (0, 0) to (radius, 0, 0)', () => {
    const v = latLngToVec3(0, 0, 1)
    approxEqualVec(v, new THREE.Vector3(1, 0, 0))
  })

  it('maps the north pole (90, anything) to (0, radius, 0)', () => {
    const v = latLngToVec3(90, 42, 1)
    approxEqualVec(v, new THREE.Vector3(0, 1, 0))
  })

  it('maps the south pole (-90, anything) to (0, -radius, 0)', () => {
    const v = latLngToVec3(-90, -17, 1)
    approxEqualVec(v, new THREE.Vector3(0, -1, 0))
  })

  it('maps (0, 90) to (0, 0, radius)', () => {
    const v = latLngToVec3(0, 90, 1)
    approxEqualVec(v, new THREE.Vector3(0, 0, 1))
  })

  it('maps (0, 180) to (-radius, 0, 0)', () => {
    const v = latLngToVec3(0, 180, 1)
    approxEqualVec(v, new THREE.Vector3(-1, 0, 0))
  })

  it('scales by the radius parameter', () => {
    const v = latLngToVec3(0, 0, 5)
    approxEqualVec(v, new THREE.Vector3(5, 0, 0))
  })
})

describe('slerpOnSphere', () => {
  it('returns a verbatim at t=0', () => {
    const a = new THREE.Vector3(1, 0, 0)
    const b = new THREE.Vector3(0, 1, 0)
    approxEqualVec(slerpOnSphere(a, b, 0), a)
  })

  it('returns b verbatim at t=1', () => {
    const a = new THREE.Vector3(1, 0, 0)
    const b = new THREE.Vector3(0, 1, 0)
    approxEqualVec(slerpOnSphere(a, b, 1), b)
  })

  it('returns the midpoint on the great circle at t=0.5', () => {
    // From (1,0,0) to (0,1,0) — midpoint is (cos 45°, sin 45°, 0) on the unit circle.
    const a = new THREE.Vector3(1, 0, 0)
    const b = new THREE.Vector3(0, 1, 0)
    const mid = slerpOnSphere(a, b, 0.5)
    const expected = new THREE.Vector3(Math.SQRT1_2, Math.SQRT1_2, 0)
    approxEqualVec(mid, expected)
  })

  it('output lies on the unit sphere for inputs on the unit sphere', () => {
    const a = new THREE.Vector3(1, 0, 0)
    const b = new THREE.Vector3(0, 0, 1)
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const out = slerpOnSphere(a, b, t)
      expect(out.length()).toBeCloseTo(1, 5)
    }
  })
})

describe('triangulatePolygonFan', () => {
  it('triangulates a 4-vertex polygon into n-2 = 2 triangles via fan from centroid', () => {
    // Square in the xz-plane.
    const vertices = [
      new THREE.Vector3(1, 0, 1),
      new THREE.Vector3(-1, 0, 1),
      new THREE.Vector3(-1, 0, -1),
      new THREE.Vector3(1, 0, -1),
    ]
    const { positions, indices } = triangulatePolygonFan(vertices)
    // 4 vertices + 1 centroid = 5 positions; positions is flat [x,y,z,...] = 15 floats.
    expect(positions.length).toBe(15)
    // 4 fan triangles around the centroid.
    expect(indices.length).toBe(12)
  })

  it('places the centroid as position index 0', () => {
    const vertices = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(-1, 0, 0),
    ]
    const { positions } = triangulatePolygonFan(vertices)
    // Centroid of (1,0,0), (0,1,0), (-1,0,0) is (0, 1/3, 0).
    expect(positions[0]).toBeCloseTo(0, 5)
    expect(positions[1]).toBeCloseTo(1 / 3, 5)
    expect(positions[2]).toBeCloseTo(0, 5)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/tectonics/sphericalGeometry.spec.ts`
Expected: FAIL with "Cannot find module './sphericalGeometry'".

- [ ] **Step 3: Write `src/tectonics/sphericalGeometry.ts`**

```ts
import * as THREE from 'three'

/**
 * Converts a (lat, lng) degree pair to a 3D Cartesian point on a sphere of
 * given radius. Uses the convention:
 *   (lat=0, lng=0)   -> (radius, 0, 0)
 *   (lat=90, *)      -> (0, radius, 0)   (north pole, +Y axis)
 *   (lat=0, lng=90)  -> (0, 0, radius)   (+Z axis)
 *
 * This matches three.js's default Y-up orientation; the Earth mesh in the
 * scene uses the same convention.
 */
export function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (lat * Math.PI) / 180
  const theta = (lng * Math.PI) / 180
  const cosPhi = Math.cos(phi)
  return new THREE.Vector3(
    radius * cosPhi * Math.cos(theta),
    radius * Math.sin(phi),
    radius * cosPhi * Math.sin(theta),
  )
}

/**
 * Spherical linear interpolation between two points on the unit sphere.
 * The output lies on the great-circle arc from `a` to `b`. Inputs are
 * expected to lie on the unit sphere; the output will too.
 *
 * t in [0, 1]; t=0 returns a (clone), t=1 returns b (clone).
 *
 * Handles the antipodal and near-zero-angle degenerate cases by falling
 * back to lerp + renormalize.
 */
export function slerpOnSphere(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  if (t <= 0) return a.clone()
  if (t >= 1) return b.clone()

  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1)
  const angle = Math.acos(dot)

  // If the angle is tiny, slerp reduces to lerp. If it's near π (antipodal),
  // the great-circle path is undefined - fall back to lerp + renormalize.
  if (angle < 1e-6 || Math.PI - angle < 1e-6) {
    return new THREE.Vector3()
      .copy(a)
      .lerp(b, t)
      .normalize()
  }

  const sinAngle = Math.sin(angle)
  const wa = Math.sin((1 - t) * angle) / sinAngle
  const wb = Math.sin(t * angle) / sinAngle

  return new THREE.Vector3()
    .copy(a)
    .multiplyScalar(wa)
    .addScaledVector(b, wb)
}

/**
 * Triangulates a convex (or near-convex) polygon as a triangle fan from the
 * polygon's centroid.
 *
 * Returns:
 *   positions: Float32Array of (centroid, v0, v1, ..., vN) as flat [x,y,z,...]
 *   indices:   Uint32Array of triangle indices forming N triangles
 *              (centroid, vI, v[I+1]) for I = 0..N-1 (wrapping)
 *
 * Limitations: only correct for convex polygons. Our hand-authored plate
 * polygons are simplified to be near-convex; if a polygon is wildly concave
 * the rendered shape may include overlapping triangles.
 */
export function triangulatePolygonFan(
  verticesVec3: ReadonlyArray<THREE.Vector3>,
): { positions: Float32Array; indices: Uint32Array } {
  const n = verticesVec3.length

  // Centroid = average of vertices (good enough for near-convex polygons).
  const centroid = new THREE.Vector3()
  for (const v of verticesVec3) centroid.add(v)
  centroid.divideScalar(n)

  // Positions: centroid first, then all n vertices. Total = n + 1 positions.
  const positions = new Float32Array((n + 1) * 3)
  positions[0] = centroid.x
  positions[1] = centroid.y
  positions[2] = centroid.z
  for (let i = 0; i < n; i++) {
    const v = verticesVec3[i] as THREE.Vector3
    positions[(i + 1) * 3 + 0] = v.x
    positions[(i + 1) * 3 + 1] = v.y
    positions[(i + 1) * 3 + 2] = v.z
  }

  // Indices: n triangles, each (centroid=0, vI=1+i, v[I+1]=1+((i+1) % n)).
  const indices = new Uint32Array(n * 3)
  for (let i = 0; i < n; i++) {
    indices[i * 3 + 0] = 0
    indices[i * 3 + 1] = 1 + i
    indices[i * 3 + 2] = 1 + ((i + 1) % n)
  }

  return { positions, indices }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/tectonics/sphericalGeometry.spec.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tectonics/sphericalGeometry.ts src/tectonics/sphericalGeometry.spec.ts
git commit -m "Add sphericalGeometry helpers with TDD coverage

latLngToVec3: degree-pair -> 3D Cartesian on sphere of given radius
(Y-up convention matching three.js and the Earth mesh).
slerpOnSphere: great-circle interpolation between two unit-sphere
points; falls back to lerp+renormalize at degenerate angles.
triangulatePolygonFan: convex polygon -> fan triangulation from
centroid, returns flat positions + index arrays for BufferGeometry."
```

---

## Task 4: tweenPlates — interpolator (strict TDD)

**Files:**
- Create: `src/tectonics/tweenPlates.ts`
- Create: `src/tectonics/tweenPlates.spec.ts`

- [ ] **Step 1: Write the failing tests** at `src/tectonics/tweenPlates.spec.ts`

```ts
import { describe, expect, it } from 'vitest'
import { ERAS_BY_ID } from './eras'
import { tweenPlates } from './tweenPlates'

describe('tweenPlates', () => {
  const source = ERAS_BY_ID.pangaea
  const target = ERAS_BY_ID.present

  it('returns source plates verbatim at t=0', () => {
    const out = tweenPlates(source, target, 0)
    expect(out).toHaveLength(source.plates.length)
    for (const tweened of out) {
      const sourcePlate = source.plates.find((p) => p.id === tweened.id)
      expect(sourcePlate).toBeDefined()
      expect(tweened.vertices.length).toBe(sourcePlate?.vertices.length)
      for (let i = 0; i < tweened.vertices.length; i++) {
        const [tlat, tlng] = tweened.vertices[i] as [number, number]
        const [slat, slng] = sourcePlate?.vertices[i] as [number, number]
        expect(tlat).toBeCloseTo(slat, 4)
        expect(tlng).toBeCloseTo(slng, 4)
      }
    }
  })

  it('returns target plates verbatim at t=1', () => {
    const out = tweenPlates(source, target, 1)
    expect(out).toHaveLength(target.plates.length)
    for (const tweened of out) {
      const targetPlate = target.plates.find((p) => p.id === tweened.id)
      expect(targetPlate).toBeDefined()
      expect(tweened.vertices.length).toBe(targetPlate?.vertices.length)
      for (let i = 0; i < tweened.vertices.length; i++) {
        const [tlat, tlng] = tweened.vertices[i] as [number, number]
        const [slat, slng] = targetPlate?.vertices[i] as [number, number]
        expect(tlat).toBeCloseTo(slat, 4)
        expect(tlng).toBeCloseTo(slng, 4)
      }
    }
  })

  it('returns vertices roughly between source and target at t=0.5', () => {
    const out = tweenPlates(source, target, 0.5)
    const pacificTweened = out.find((p) => p.id === 'pacific')
    const pacificSource = source.plates.find((p) => p.id === 'pacific')
    const pacificTarget = target.plates.find((p) => p.id === 'pacific')
    expect(pacificTweened).toBeDefined()
    expect(pacificSource).toBeDefined()
    expect(pacificTarget).toBeDefined()
    if (!pacificTweened || !pacificSource || !pacificTarget) return
    for (let i = 0; i < pacificTweened.vertices.length; i++) {
      const [tlat, tlng] = pacificTweened.vertices[i] as [number, number]
      const [slat, slng] = pacificSource.vertices[i] as [number, number]
      const [glat, glng] = pacificTarget.vertices[i] as [number, number]
      // Midpoint should be between source and target on each axis (with some
      // wraparound tolerance on longitude). For non-wraparound cases, the
      // tweened value lies between source and target.
      const minLat = Math.min(slat, glat) - 5
      const maxLat = Math.max(slat, glat) + 5
      expect(tlat).toBeGreaterThanOrEqual(minLat)
      expect(tlat).toBeLessThanOrEqual(maxLat)
    }
  })

  it('includes all seven plates in the output', () => {
    const out = tweenPlates(source, target, 0.5)
    const ids = out.map((p) => p.id).sort()
    expect(ids).toEqual(
      ['pacific', 'north-american', 'eurasian', 'african', 'south-american', 'antarctic', 'indo-australian'].sort(),
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/tectonics/tweenPlates.spec.ts`
Expected: FAIL with "Cannot find module './tweenPlates'".

- [ ] **Step 3: Write `src/tectonics/tweenPlates.ts`**

```ts
import * as THREE from 'three'
import type { Era, PlateId } from './eras'
import { latLngToVec3, slerpOnSphere } from './sphericalGeometry'

export interface TweenedPlate {
  id: PlateId
  vertices: ReadonlyArray<readonly [number, number]>
}

/**
 * Interpolates plate positions between two eras at progress t in [0, 1].
 *
 * For each plate present in both eras, each vertex pair (source, target) is
 * SLERP'd along the great-circle arc on the unit sphere, then projected back
 * to (lat, lng) degrees. Vertex counts must match between source and target
 * (enforced at data-integrity test time in eras.spec.ts).
 *
 * At t=0 returns source plates verbatim; at t=1 returns target verbatim.
 */
export function tweenPlates(source: Era, target: Era, t: number): ReadonlyArray<TweenedPlate> {
  const result: TweenedPlate[] = []

  for (const sourcePlate of source.plates) {
    const targetPlate = target.plates.find((p) => p.id === sourcePlate.id)
    if (!targetPlate) continue

    if (t <= 0) {
      result.push({ id: sourcePlate.id, vertices: sourcePlate.vertices })
      continue
    }
    if (t >= 1) {
      result.push({ id: sourcePlate.id, vertices: targetPlate.vertices })
      continue
    }

    const interpolated: Array<readonly [number, number]> = []
    for (let i = 0; i < sourcePlate.vertices.length; i++) {
      const [slat, slng] = sourcePlate.vertices[i] as [number, number]
      const [tlat, tlng] = targetPlate.vertices[i] as [number, number]

      const va = latLngToVec3(slat, slng, 1)
      const vb = latLngToVec3(tlat, tlng, 1)
      const vi = slerpOnSphere(va, vb, t)

      // Convert interpolated vec3 back to (lat, lng) degrees.
      // lat = asin(y); lng = atan2(z, x).
      const lat = (Math.asin(THREE.MathUtils.clamp(vi.y, -1, 1)) * 180) / Math.PI
      const lng = (Math.atan2(vi.z, vi.x) * 180) / Math.PI
      interpolated.push([lat, lng] as const)
    }

    result.push({ id: sourcePlate.id, vertices: interpolated })
  }

  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/tectonics/tweenPlates.spec.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tectonics/tweenPlates.ts src/tectonics/tweenPlates.spec.ts
git commit -m "Add tweenPlates SLERP-based interpolator with TDD

For each plate present in both source and target eras, lerps every
vertex along the great-circle arc on the unit sphere (via slerpOnSphere
from sphericalGeometry), then projects back to (lat, lng) degrees.

SLERP avoids the antimeridian and pole-crossing artifacts that naive
lat/lng linear interpolation would produce."
```

---

## Task 5: tectonicsSlice — state machine (strict TDD)

Add a new Zustand slice for Tectonics state, wire it into the existing combined store.

**Files:**
- Create: `src/tectonics/tectonicsSlice.ts`
- Create: `src/tectonics/tectonicsSlice.spec.ts`
- Modify: `src/store/index.ts` (merge the new slice into `useStore`)

- [ ] **Step 1: Write the failing tests** at `src/tectonics/tectonicsSlice.spec.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function freshStore() {
  vi.resetModules()
  const mod = await import('@/src/store')
  return mod.useStore
}

describe('tectonicsSlice', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to currentEraId=present, targetEraId=null, playing=false', async () => {
    const store = await freshStore()
    const state = store.getState()
    expect(state.currentEraId).toBe('present')
    expect(state.targetEraId).toBeNull()
    expect(state.playing).toBe(false)
    expect(state.tweenStartedAt).toBeNull()
  })

  it('setTargetEra updates target + tweenStartedAt', async () => {
    const store = await freshStore()
    store.getState().setTargetEra('pangaea')
    const state = store.getState()
    expect(state.targetEraId).toBe('pangaea')
    expect(state.tweenStartedAt).not.toBeNull()
    expect(state.tweenStartedAt).toBeGreaterThan(0)
  })

  it('setTargetEra is a no-op if the id equals currentEraId and not playing', async () => {
    const store = await freshStore()
    store.getState().setTargetEra('present')
    expect(store.getState().targetEraId).toBeNull()
  })

  it('finishTween commits target to current and clears tween fields', async () => {
    const store = await freshStore()
    store.getState().setTargetEra('pangaea')
    store.getState().finishTween()
    const state = store.getState()
    expect(state.currentEraId).toBe('pangaea')
    expect(state.targetEraId).toBeNull()
    expect(state.tweenStartedAt).toBeNull()
  })

  it('startPlaythrough sets playing=true and advances to the next era', async () => {
    const store = await freshStore()
    // Default is 'present'. Next in ERAS array (after present) is 'future'.
    store.getState().startPlaythrough()
    const state = store.getState()
    expect(state.playing).toBe(true)
    expect(state.targetEraId).toBe('future')
  })

  it('finishTween during playthrough auto-advances to the next era', async () => {
    const store = await freshStore()
    store.getState().startPlaythrough() // target = 'future'
    store.getState().finishTween()      // current = 'future', target = next after future
    // After 'future' wraps to 'pangaea' (first era).
    const state = store.getState()
    expect(state.currentEraId).toBe('future')
    expect(state.targetEraId).toBe('pangaea')
    expect(state.playing).toBe(true)
  })

  it('stopPlaythrough sets playing=false but leaves an in-flight tween alone', async () => {
    const store = await freshStore()
    store.getState().setTargetEra('pangaea')
    store.getState().startPlaythrough() // playing=true; tween is to pangaea
    store.getState().stopPlaythrough()
    const state = store.getState()
    expect(state.playing).toBe(false)
    // In-flight tween still resolves.
    expect(state.targetEraId).toBe('pangaea')
  })

  it('finishTween after stopPlaythrough does NOT auto-advance', async () => {
    const store = await freshStore()
    store.getState().startPlaythrough() // playing=true, target=future
    store.getState().stopPlaythrough()  // playing=false
    store.getState().finishTween()      // commits target, but playing=false so no advance
    const state = store.getState()
    expect(state.currentEraId).toBe('future')
    expect(state.targetEraId).toBeNull()
    expect(state.playing).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/tectonics/tectonicsSlice.spec.ts`
Expected: FAIL with "Cannot find module" for either the slice file or because `useStore` doesn't yet expose the tectonics fields.

- [ ] **Step 3: Write `src/tectonics/tectonicsSlice.ts`**

```ts
import type { StateCreator } from 'zustand'
import { ERAS, type Era } from './eras'

export interface TectonicsSlice {
  currentEraId: Era['id']
  targetEraId: Era['id'] | null
  tweenStartedAt: number | null
  playing: boolean

  setTargetEra: (id: Era['id']) => void
  finishTween: () => void
  startPlaythrough: () => void
  stopPlaythrough: () => void
}

function nextEraId(currentId: Era['id']): Era['id'] {
  const idx = ERAS.findIndex((e) => e.id === currentId)
  const nextIdx = (idx + 1) % ERAS.length
  return ERAS[nextIdx]!.id
}

export const createTectonicsSlice: StateCreator<TectonicsSlice> = (set, get) => ({
  currentEraId: 'present',
  targetEraId: null,
  tweenStartedAt: null,
  playing: false,

  setTargetEra: (id) => {
    const state = get()
    if (id === state.currentEraId && !state.playing) return
    set({ targetEraId: id, tweenStartedAt: performance.now() })
  },

  finishTween: () => {
    const state = get()
    const committed = state.targetEraId ?? state.currentEraId
    set({
      currentEraId: committed,
      targetEraId: null,
      tweenStartedAt: null,
    })
    if (state.playing) {
      // Schedule the next era. Reach back into setTargetEra via get() so the
      // tween-start guard still fires.
      get().setTargetEra(nextEraId(committed))
    }
  },

  startPlaythrough: () => {
    const state = get()
    set({ playing: true })
    if (state.targetEraId === null) {
      get().setTargetEra(nextEraId(state.currentEraId))
    }
  },

  stopPlaythrough: () => {
    set({ playing: false })
  },
})
```

- [ ] **Step 4: Modify `src/store/index.ts`** to merge in the new slice

Current top of `src/store/index.ts`:
```ts
import { create } from 'zustand'
import { createShellSlice, type ShellSlice } from './shellSlice'

type Store = ShellSlice & { ... }
```

Change to import + merge the tectonics slice:
```ts
import { create } from 'zustand'
import { createShellSlice, type ShellSlice } from './shellSlice'
import { createTectonicsSlice, type TectonicsSlice } from '@/src/tectonics/tectonicsSlice'

type Store = ShellSlice & TectonicsSlice & {
  __flushPersist?: () => void
}
```

Then inside the `create<Store>()(...)` factory, where the existing code creates the shell slice, ALSO create the tectonics slice and merge both:

Current factory body roughly:
```ts
export const useStore = create<Store>()((set, get, api) => {
  const slice = createShellSlice(set, get, api)
  const rehydrated = readPersistedShell()

  return {
    ...slice,
    ...rehydrated,
    __flushPersist: () => persistShell(get() as ShellSlice),
  }
})
```

Change to:
```ts
export const useStore = create<Store>()((set, get, api) => {
  const shellSlicePart = createShellSlice(set, get, api)
  const tectonicsSlicePart = createTectonicsSlice(set, get, api)
  const rehydrated = readPersistedShell()

  return {
    ...shellSlicePart,
    ...tectonicsSlicePart,
    ...rehydrated,
    __flushPersist: () => persistShell(get() as ShellSlice),
  }
})
```

The existing `useStore.subscribe(persistShell)` line stays unchanged — `persistShell` only writes the shell fields (tierOverride, activeModule, highContrast). Tectonics state is intentionally not persisted; navigating away and back resets to `currentEraId: 'present'`.

The TypeScript cast `get() as ShellSlice` in `__flushPersist` still works because `Store` is a superset of `ShellSlice`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/tectonics/tectonicsSlice.spec.ts`
Expected: all tests PASS.

Also run the existing shell tests to confirm no regression:
Run: `pnpm test src/store/shellSlice.spec.ts`
Expected: all 18 prior tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/tectonics/tectonicsSlice.ts src/tectonics/tectonicsSlice.spec.ts src/store/index.ts
git commit -m "Add tectonicsSlice with playthrough state machine

Zustand slice merged into useStore alongside shellSlice. Tracks
currentEraId, targetEraId, tweenStartedAt, playing. setTargetEra is
a no-op if target equals current and not playing. finishTween commits
the in-flight tween and (when playing) auto-advances to the next era,
wrapping from future back to pangaea. stopPlaythrough leaves any
in-flight tween alone but suppresses auto-advance on completion.

Tectonics state is intentionally not persisted - navigating away and
back resets to present."
```

---

## Task 6: `<Plate>` — single plate mesh

R3F component, no unit tests (visual + e2e verification).

**Files:**
- Create: `src/tectonics/scene/Plate.tsx`

- [ ] **Step 1: Write `src/tectonics/scene/Plate.tsx`**

```tsx
'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { latLngToVec3, triangulatePolygonFan } from '../sphericalGeometry'

const PLATE_RADIUS = 1.001 // just above the Earth surface (radius 1) to avoid z-fight

interface PlateProps {
  /** Plate vertices as [lat, lng] degree pairs. */
  vertices: ReadonlyArray<readonly [number, number]>
  color: string
}

/**
 * Renders a single plate as a colored mesh on the sphere surface. Re-builds
 * its BufferGeometry every time `vertices` changes; the parent <Plates>
 * passes new tweened vertex arrays each frame during an era transition.
 */
export function Plate({ vertices, color }: PlateProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  // Rebuild geometry whenever vertices change.
  const geometry = useMemo(() => {
    const vec3s = vertices.map(([lat, lng]) =>
      latLngToVec3(lat, lng, PLATE_RADIUS),
    )
    const { positions, indices } = triangulatePolygonFan(vec3s)

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setIndex(new THREE.BufferAttribute(indices, 1))
    geom.computeVertexNormals()
    return geom
  }, [vertices])

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        color={color}
        metalness={0.05}
        roughness={0.85}
        emissive={new THREE.Color(color)}
        emissiveIntensity={0.15}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
```

`side={THREE.DoubleSide}` is intentional — it removes the need to worry about vertex winding order. If a plate would otherwise render inside-out, double-sided rendering shows it correctly from any angle. Cost: slight overdraw, acceptable for ~7 plates with <50 triangles each.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/tectonics/scene/Plate.tsx
git commit -m "Add <Plate> single-plate mesh component

Builds a BufferGeometry from the plate's [lat,lng] vertices via fan
triangulation, rendered at radius 1.001 (just above the Earth surface
to avoid z-fighting). Uses DoubleSide to sidestep winding-order
concerns in the hand-authored vertex data. Subtle emissive (0.15)
keeps plate colors readable against the Earth's PBR materials."
```

---

## Task 7: `<Plates>` — group with useFrame interpolation

**Files:**
- Create: `src/tectonics/scene/Plates.tsx`

- [ ] **Step 1: Write `src/tectonics/scene/Plates.tsx`**

```tsx
'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { usePrefersReducedMotion } from '@/src/lib/accessibility'
import { ERAS_BY_ID, PLATE_COLORS, type PlateId } from '../eras'
import { tweenPlates, type TweenedPlate } from '../tweenPlates'
import { Plate } from './Plate'

const TWEEN_DURATION_MS = 5000

/**
 * R3F group that renders the seven plates when activeModule === 'tectonics'.
 * Each frame, computes the tween progress between currentEraId and
 * targetEraId, calls tweenPlates with eased progress, and passes the
 * interpolated vertices to each <Plate> child.
 *
 * When the tween completes (t >= 1), calls finishTween() so the slice can
 * commit and (if playing) advance to the next era.
 */
export function Plates() {
  const activeModule = useStore((s) => s.activeModule)
  const currentEraId = useStore((s) => s.currentEraId)
  const targetEraId = useStore((s) => s.targetEraId)
  const tweenStartedAt = useStore((s) => s.tweenStartedAt)
  const finishTween = useStore((s) => s.finishTween)
  const prefersReducedMotion = usePrefersReducedMotion()

  // Local state of the tweened plates so we re-render each frame during a
  // transition without forcing a parent re-render.
  const [tweenedPlates, setTweenedPlates] = useState<ReadonlyArray<TweenedPlate>>(() =>
    tweenPlates(ERAS_BY_ID[currentEraId], ERAS_BY_ID[currentEraId], 1),
  )

  // When the source or target era changes (without a frame yet rendering),
  // immediately recompute the tween at t=0 so the next frame's interpolation
  // starts from the right baseline.
  useEffect(() => {
    if (targetEraId === null) {
      setTweenedPlates(tweenPlates(ERAS_BY_ID[currentEraId], ERAS_BY_ID[currentEraId], 1))
    } else if (prefersReducedMotion) {
      // Skip animation entirely - snap to target.
      setTweenedPlates(tweenPlates(ERAS_BY_ID[currentEraId], ERAS_BY_ID[targetEraId], 1))
      finishTween()
    }
  }, [currentEraId, targetEraId, prefersReducedMotion, finishTween])

  useFrame(() => {
    if (targetEraId === null || tweenStartedAt === null) return
    if (prefersReducedMotion) return // handled by useEffect above

    const elapsed = performance.now() - tweenStartedAt
    const raw = Math.min(elapsed / TWEEN_DURATION_MS, 1)
    // Smoothstep ease.
    const eased = raw * raw * (3 - 2 * raw)

    const source = ERAS_BY_ID[currentEraId]
    const target = ERAS_BY_ID[targetEraId]
    setTweenedPlates(tweenPlates(source, target, eased))

    if (raw >= 1) finishTween()
  })

  if (activeModule !== 'tectonics') return null

  return (
    <group>
      {tweenedPlates.map((plate) => (
        <Plate
          key={plate.id}
          vertices={plate.vertices}
          color={PLATE_COLORS[plate.id as PlateId]}
        />
      ))}
    </group>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/tectonics/scene/Plates.tsx
git commit -m "Add <Plates> group with useFrame era interpolation

Subscribes to currentEraId, targetEraId, tweenStartedAt. Each frame
computes smoothstep-eased progress, calls tweenPlates() with the
result, and stores the interpolated vertices in local state. When
t >= 1 calls finishTween() to commit + auto-advance during play.

Conditionally renders only when activeModule === 'tectonics' so the
component stays mounted in the persistent scene without contributing
geometry on other routes.

Reduced-motion users skip the animation entirely - the useEffect
snaps to the target on era change."
```

---

## Task 8: Integration — PersistentScene + modules.tsx

Mount `<Plates>` inside the persistent scene, and replace the Tectonics stub Body with the real TectonicsBody (created in Task 9, but referenced here so we can integrate end-to-end).

We'll create a minimal placeholder TectonicsBody first so the import resolves; Task 9 fills it in.

**Files:**
- Modify: `src/scene/PersistentScene.tsx`
- Create: `src/tectonics/ui/TectonicsBody.tsx` (minimal placeholder; full impl in Task 9)
- Modify: `src/shell/modules.tsx`

- [ ] **Step 1: Add `<Plates>` to PersistentScene**

Edit `src/scene/PersistentScene.tsx`. Add the import:
```tsx
import { Plates } from '@/src/tectonics/scene/Plates'
```

Inside the Scene's children, add `<Plates />` after the existing scene contents (e.g., after `<PostProcessing />` or wherever the existing children list ends):
```tsx
<Scene controls={false}>
  <Earth />
  <CameraDolly />
  <PostProcessing />
  <Plates />
</Scene>
```

`<Plates>` self-gates on `activeModule === 'tectonics'`, so mounting it unconditionally is safe.

- [ ] **Step 2: Create a minimal `TectonicsBody.tsx` placeholder**

Create `src/tectonics/ui/TectonicsBody.tsx`:

```tsx
'use client'

// Real implementation in Task 9; this minimal placeholder lets modules.tsx
// reference TectonicsBody before the full sidebar UI lands.
export function TectonicsBody() {
  return <div>Tectonics body — wiring in progress</div>
}
```

- [ ] **Step 3: Wire `TectonicsBody` into the modules registry**

Edit `src/shell/modules.tsx`. Add the import near the top:
```tsx
import { TectonicsBody } from '@/src/tectonics/ui/TectonicsBody'
```

Find the `MODULES.tectonics` entry. It currently has:
```tsx
Body: makeStub('Tectonics', '#ff8c5a'),
```

Replace with:
```tsx
Body: TectonicsBody,
```

The `makeStub` helper function and the other modules (`atmosphere`, `systems`) remain unchanged.

- [ ] **Step 4: Verify typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 5: Run dev server and visually verify**

Run: `pnpm dev` in background. Curl `/` (200) and `/tectonics` (200). Kill the server. Visual verification will come in Task 12 (final review); for now we just confirm the routes still resolve.

- [ ] **Step 6: Commit**

```bash
git add src/scene/PersistentScene.tsx src/tectonics/ui/TectonicsBody.tsx src/shell/modules.tsx
git commit -m "Integrate Plates into PersistentScene + wire TectonicsBody

PersistentScene now mounts <Plates /> as a child; Plates self-gates on
activeModule so it stays inactive on hub/atmosphere/systems routes.
modules.tsx replaces the makeStub placeholder for Tectonics with the
real TectonicsBody component. The Body itself is a minimal placeholder
in this commit; Task 9 fills in the sidebar UI."
```

---

## Task 9: `<TectonicsBody>` — sidebar UI (era description, tier-aware)

Replace the placeholder created in Task 8 with the real sidebar UI.

**Files:**
- Modify: `src/tectonics/ui/TectonicsBody.tsx`

- [ ] **Step 1: Replace `src/tectonics/ui/TectonicsBody.tsx`** with the full implementation

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { ERAS_BY_ID, type Era } from '../eras'
import { Timeline } from './Timeline'

/**
 * Sidebar body for the Tectonics module. Shows the era name + Mya +
 * tier-appropriate description. While a tween is in progress, displays
 * the target era's data so the user knows where they're heading.
 *
 * Also renders the Timeline component, which positions itself at the
 * bottom of the viewport via fixed positioning.
 */
export function TectonicsBody() {
  const currentEraId = useStore((s) => s.currentEraId)
  const targetEraId = useStore((s) => s.targetEraId)
  const tierOverride = useStore((s) => s.tierOverride)

  // Mount guard to avoid SSR/client hydration mismatch on tier-dependent
  // text (matches the pattern from TierToggle).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const displayedEraId = targetEraId ?? currentEraId
  const era: Era = ERAS_BY_ID[displayedEraId]

  // Tier-dependent verbosity:
  //   mobile-lite -> Beginner copy
  //   balanced    -> Standard
  //   desktop-ultra -> Advanced
  //   null (auto) -> Standard (sensible default)
  const effectiveTierOverride = mounted ? tierOverride : null
  const description =
    effectiveTierOverride === 'mobile-lite'
      ? era.descriptionBeginner
      : effectiveTierOverride === 'desktop-ultra'
        ? era.descriptionAdvanced
        : era.descriptionStandard

  const showMya = effectiveTierOverride !== 'mobile-lite' // Beginner tier hides numbers

  return (
    <>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">{era.name}</h2>
          {showMya && (
            <p className="text-xs text-muted-foreground">
              {era.mya > 0 ? `${era.mya} million years ago` : era.mya === 0 ? 'Today' : `${-era.mya} million years from now`}
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <Timeline />
    </>
  )
}
```

This file imports `Timeline` from `./Timeline`, which doesn't exist yet — it's created in Task 10. Typecheck will fail at this step, which is expected. Task 10 creates Timeline and the import resolves.

- [ ] **Step 2: Verify typecheck FAILS** (transient — fixed in Task 10)

Run: `pnpm typecheck`
Expected: FAIL with "Cannot find module './Timeline'" or similar. This is expected and fixed by Task 10.

Do NOT commit this step alone. The commit lands at the end of Task 10 after both files exist.

---

## Task 10: `<Timeline>` — bottom-of-viewport era picker

The companion to Task 9. After this task both files commit together.

**Files:**
- Create: `src/tectonics/ui/Timeline.tsx`

- [ ] **Step 1: Write `src/tectonics/ui/Timeline.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useStore } from '@/src/store'
import { ERAS, type Era } from '../eras'

const MIN_MYA = -50  // Future projection (rightmost on timeline)
const MAX_MYA = 250  // Pangaea (leftmost on timeline)

/**
 * Maps an era's mya value to its horizontal position on the timeline
 * (0 = left edge / Pangaea, 1 = right edge / Future).
 */
function eraXPosition(era: Era): number {
  return (MAX_MYA - era.mya) / (MAX_MYA - MIN_MYA)
}

export function Timeline() {
  const currentEraId = useStore((s) => s.currentEraId)
  const targetEraId = useStore((s) => s.targetEraId)
  const playing = useStore((s) => s.playing)
  const setTargetEra = useStore((s) => s.setTargetEra)
  const startPlaythrough = useStore((s) => s.startPlaythrough)
  const stopPlaythrough = useStore((s) => s.stopPlaythrough)

  // Mount guard so the active marker doesn't mismatch on hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const displayedEraId = mounted ? (targetEraId ?? currentEraId) : 'present'

  return (
    <div className="pointer-events-auto fixed z-20 bottom-4 inset-x-4 sm:left-80 sm:right-4 flex items-center gap-3 rounded-lg border border-border/40 bg-card/85 px-4 py-3 backdrop-blur">
      {/* Play / Stop button */}
      <button
        type="button"
        onClick={() => (playing ? stopPlaythrough() : startPlaythrough())}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card text-foreground hover:bg-foreground/10"
        aria-label={playing ? 'Stop playthrough' : 'Start playthrough'}
      >
        {playing ? '◼' : '▶'}
      </button>

      {/* Timeline track + era markers */}
      <div className="relative flex-1 h-9">
        {/* Axis line */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border/60" />
        {/* Era markers */}
        {ERAS.map((era) => {
          const x = eraXPosition(era)
          const isActive = era.id === displayedEraId
          return (
            <button
              key={era.id}
              type="button"
              onClick={() => setTargetEra(era.id)}
              title={`${era.name}${era.mya > 0 ? ` (${era.mya} Mya)` : era.mya === 0 ? '' : ` (+${-era.mya} Myr)`}`}
              aria-label={era.name}
              className={cn(
                'absolute top-1/2 -translate-x-1/2 -translate-y-1/2',
                'flex flex-col items-center gap-1',
              )}
              style={{ left: `${x * 100}%` }}
            >
              <span
                className={cn(
                  'block h-3 w-3 rounded-full border',
                  isActive
                    ? 'bg-foreground border-foreground shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                    : 'bg-card border-foreground/60 hover:bg-foreground/20',
                )}
              />
              <span className="text-[10px] uppercase tracking-wider text-foreground/70 whitespace-nowrap">
                {era.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: exit 0 (both `TectonicsBody.tsx` and `Timeline.tsx` now exist, imports resolve).

- [ ] **Step 3: Verify lint**

Run: `pnpm lint`
Expected: exit 0 (autofix with `pnpm lint:fix` if biome flags formatter prefs).

- [ ] **Step 4: Run dev server, manually verify**

Run: `pnpm dev` in background. Curl `/tectonics` (200). Kill.

Visual verification happens in Task 12; this step just confirms the build doesn't break.

- [ ] **Step 5: Commit BOTH files together**

```bash
git add src/tectonics/ui/TectonicsBody.tsx src/tectonics/ui/Timeline.tsx
git commit -m "Add TectonicsBody sidebar + Timeline picker UI

TectonicsBody renders the era name + Mya (hidden on Beginner tier) +
tier-aware description (Beginner/Standard/Advanced text from era data).
Uses a mount guard to avoid SSR/client hydration mismatch on tier-
dependent text.

Timeline is a fixed-positioned bottom strip: Play button + horizontal
axis with six clickable era markers. Marker position is proportional
to mya in the [250, -50] range. Current/target era marker is filled +
glowing; others are outline only."
```

---

## Task 11: Playwright e2e for Tectonics

**Files:**
- Create: `tests/e2e/tectonics.spec.ts`

- [ ] **Step 1: Write the spec file**

```ts
import { expect, test } from '@playwright/test'

test('Tectonics route renders plates + timeline', async ({ page }) => {
  await page.goto('/tectonics')
  await expect(page.locator('canvas')).toBeVisible()
  // Era name is in the sidebar; default is 'Present'.
  await expect(page.getByText('Present', { exact: true })).toBeVisible()
  // Six era markers in the timeline.
  for (const eraName of ['Pangaea', 'Late Jurassic', 'Late Cretaceous', 'Eocene', 'Present', 'Future (Projected)']) {
    await expect(page.getByRole('button', { name: eraName })).toBeVisible()
  }
})

test('clicking an era marker updates the sidebar after the tween', async ({ page }) => {
  await page.goto('/tectonics')
  await page.getByRole('button', { name: 'Pangaea' }).click()
  // The tween is ~5s; wait for the sidebar to reflect Pangaea.
  await expect(page.getByText('Pangaea', { exact: true })).toBeVisible({ timeout: 8000 })
})

test('Play button toggles to Stop and back', async ({ page }) => {
  await page.goto('/tectonics')
  const play = page.getByRole('button', { name: 'Start playthrough' })
  await play.click()
  // Button label updates to Stop.
  await expect(page.getByRole('button', { name: 'Stop playthrough' })).toBeVisible()
  // Clicking it again returns to Play.
  await page.getByRole('button', { name: 'Stop playthrough' }).click()
  await expect(page.getByRole('button', { name: 'Start playthrough' })).toBeVisible()
})

test('Timeline is not present on the hub', async ({ page }) => {
  await page.goto('/')
  // No era markers on hub.
  await expect(page.getByRole('button', { name: 'Pangaea' })).not.toBeVisible()
})
```

- [ ] **Step 2: Run the e2e tests**

Run: `pnpm test:e2e`

Expected: all four new tests pass on both mobile-chrome and desktop-chrome projects (8 total). Plus all existing tests still pass.

If the "clicking an era marker" test flakes due to the 5s tween timing, increase the timeout (currently 8000ms) — but the tween is 5s + smoothstep, so 8s is normally safe.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/tectonics.spec.ts
git commit -m "Add Playwright e2e for Tectonics

Asserts: route renders plates + timeline with all 6 era markers; clicking
an era marker updates the sidebar after the tween completes; Play button
toggles to Stop and back; Timeline is not present on hub routes."
```

---

## Task 12: Final verification + branch push + PR creation

**Files:** none (verification + git)

- [ ] **Step 1: Run the full gauntlet**

Run sequentially:
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

Expected: each exits 0. If lint flags new violations, run `pnpm lint:fix` and stage the result.

- [ ] **Step 2: Manual visual verification**

Run: `pnpm dev`. Walk the flow:
1. Visit `/`. Hub renders the photoreal Earth with three module cards. No timeline visible. No plate overlays.
2. Click "Tectonics" → camera dollies in. Plates appear as colored polygons. Sidebar shows "Present" + description. Timeline visible at the bottom (desktop) or in the bottom sheet (mobile).
3. Click "Pangaea" on the timeline. Plates animate over ~5 seconds; sidebar updates to "Pangaea" + the era's description.
4. Click each other era marker in turn. Verify animation + sidebar update.
5. Click Play. Verify continuous walkthrough; click Stop to halt.
6. Tier toggle (top-right): switch to Lite → sidebar copy shortens to Beginner version, Mya number hides. Switch to Ultra → Advanced copy appears, Mya shown. Switch back to Auto.
7. Click Hub (back). Camera dollies back; plates disappear; hub renders normally.
8. Direct nav to `/tectonics` again. Plates render at Present.

Ctrl-C.

- [ ] **Step 3: Confirm clean working tree**

Run: `git status`
Expected: working tree clean (all changes committed).

- [ ] **Step 4: Push the branch**

Run:
```bash
git push -u origin tectonics-v1-era-viewer-spec
```

- [ ] **Step 5: Open the PR**

Run:
```bash
gh pr create --base main --title "Tectonics v1: era viewer (read-only paleogeography)" --body "$(cat <<'EOF'
## Summary

First Tectonics PR per DESIGN.md §11 Phase 2. Replaces the \`/tectonics\` placeholder with a read-only animated viewer of Earth's tectonic plates across six geological eras (Pangaea → Future). The user clicks a timeline marker, plate vertices SLERP-tween over ~5 seconds to the target era. A Play button walks all six eras over ~30 seconds.

Per the brainstorming session, this PR explicitly defers plate dragging, boundary classification, earthquake glyphs, and tutor integration to follow-up PRs. The viewer is shippable as a complete pedagogical tool on its own.

## What's in this PR

**Pure-TS modules (strict TDD):**
- \`src/tectonics/eras.ts\` — 6 eras × 7 plates × 6 vertices each (42 polygons hand-authored as simplified approximations of paleogeographic reconstructions). Includes plate display names and colors.
- \`src/tectonics/sphericalGeometry.ts\` — latLngToVec3 (Y-up convention), slerpOnSphere (great-circle interpolation), triangulatePolygonFan (BufferGeometry from convex polygon).
- \`src/tectonics/tweenPlates.ts\` — interpolates between two eras via SLERP on each vertex; avoids antimeridian/pole artifacts.
- \`src/tectonics/tectonicsSlice.ts\` — Zustand slice merged into useStore. Tracks currentEraId, targetEraId, playing, tweenStartedAt. setTargetEra is a no-op if target equals current; finishTween commits + auto-advances during playthrough.

**Scene + UI:**
- \`<Plate>\` — single plate mesh, BufferGeometry rebuilt per vertex change, DoubleSide rendering, subtle emissive.
- \`<Plates>\` — group conditionally rendered on activeModule === 'tectonics', useFrame drives smoothstep-eased SLERP interpolation, honors prefers-reduced-motion (snaps instead of tweens).
- \`<TectonicsBody>\` — sidebar with era name + Mya + tier-aware description.
- \`<Timeline>\` — fixed bottom strip with Play button + 6 clickable era markers.

**Integration:**
- PersistentScene mounts \`<Plates />\`
- modules.tsx swaps the Tectonics makeStub for TectonicsBody
- ModuleFrame mobile sidebar max-h bumped 35dvh → 45dvh to accommodate the combined era description + timeline on small screens

**Tests:**
- 4 vitest spec files (~25 tests total) for the pure-TS modules
- 4 Playwright e2e tests covering route rendering, era selection, Play toggle, and hub absence of the timeline

## Acknowledged limitations

- Plate vertex data is simplified — recognizable as Earth at each era, but not academic-grade. A visual refinement pass is expected as a follow-up.
- The Earth surface texture (modern day/night maps) shows through behind the plates at all eras. For non-Present eras the underlying continents don't align with the plate polygons. Dimming/recoloring the Earth in Tectonics mode is a separate visual-polish PR.
- ModuleFrame sidebar visual treatment is still plain (per the spec's deferred items list). Global polish lands in a dedicated UI-polish PR.

## Test plan

- [ ] \`pnpm install\` (no new deps required)
- [ ] \`pnpm typecheck\` — exit 0
- [ ] \`pnpm lint\` — exit 0
- [ ] \`pnpm test\` — all vitest spec files pass
- [ ] \`pnpm test:e2e\` — all Playwright tests pass (existing + 4 new)
- [ ] \`pnpm build\` — succeeds
- [ ] Visual: click each era marker, verify ~5s tween + sidebar update. Click Play, verify continuous walkthrough. Toggle tier, verify description verbosity changes.
EOF
)"
```

The PR creates the standard checkbox test plan; the user reviews + merges manually per their workflow.

- [ ] **Step 6: Report the PR URL** when the previous command completes.

---

## Spec coverage check

| Spec section | Covered by |
| --- | --- |
| §1 Goals + success criteria | Tasks 7 (visual rendering), 9-10 (sidebar + timeline), 11 (e2e validates), 12 (final verification) |
| §1 Reduced-motion accessibility | Task 7 (Plates honors `usePrefersReducedMotion`) |
| §2 File structure | Tasks 1–10 follow the file layout exactly |
| §3 Data model (PlateId, PlateAtEra, Era) | Task 2 |
| §3.4 The six eras | Task 2 |
| §3.5 Authoring approach (data in plan) | Task 2 embeds the full data |
| §4.1 sphericalGeometry | Task 3 |
| §4.2 eras.ts | Task 2 |
| §4.3 tweenPlates | Task 4 |
| §4.4 tectonicsSlice | Task 5 |
| §5.1 `<Plates>` | Task 7 |
| §5.2 `<Plate>` | Task 6 |
| §5.3 PersistentScene integration | Task 8 |
| §6.1 `<TectonicsBody>` | Task 9 |
| §6.2 `<Timeline>` | Task 10 |
| §6.3 Plate name labels (tier-dependent) | **Gap** — deferred. See note below. |
| §7 Layout (desktop vs mobile) | Tasks 1 (mobile max-h bump), 10 (Timeline responsive positioning) |
| §8 Testing strategy | Tasks 2–5 (TDD), Task 11 (e2e) |
| §9 Out of scope | Spec only; nothing to do |

**Gap (intentional):** §6.3 plate name labels (in-3D-scene `<Text>` labels over each plate, tier-dependent visibility) are not in this plan. Adding `<Text>` on a moving polygon requires the label to follow the plate's centroid every frame, which is straightforward but adds complexity to the `<Plate>` component. Sliced out as a follow-up to keep this PR focused. The sidebar already shows the era name, and plate colors are documented in the legend area when we add it; users can identify plates without in-scene labels at this stage.

If desired, plate labels can be re-added by extending `<Plate>` to render a `<Text>` child at the centroid position, conditionally based on `tierOverride === 'mobile-lite'` (Beginner = always on) or local hover state.

---

**End of plan.**
